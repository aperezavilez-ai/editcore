/**
 * EDITCORE INCREMENTAL KNOWLEDGE INDEXER — Prompt 7
 * Indexado incremental: solo re-procesa archivos modificados desde la última indexación.
 * Soporta multi-workspace y se integra con tech-memory.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getRagIndex } from "../rag/chunkIndex";
import { getWorkspaceIndex } from "../index/workspaceIndex";
import { appendTechMemoryEntry } from "../intelligence/techMemoryStore";

const INDEX_META_FILE = ".editcore/knowledge/index-meta.json";
const SKIP_DIRS = new Set(["node_modules", ".git", "out", "dist", "build", "coverage", ".next"]);
const TEXT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".py", ".go", ".rs", ".java", ".cs", ".sql"]);

interface IndexMeta {
  version: 2;
  workspaceId: string;
  lastIndexedAt: string;        // ISO timestamp
  fileHashes: Record<string, string>;  // rel path → mtime+size fingerprint
  totalFiles: number;
  totalChunks: number;
}

// ─── Fingerprint rápido ──────────────────────────────────────────────────────

function fingerprint(stat: fs.Stats): string {
  return `${stat.mtimeMs}:${stat.size}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMetaPath(root: string): string {
  return path.join(root, INDEX_META_FILE);
}

async function loadMeta(root: string): Promise<IndexMeta | null> {
  try {
    const raw = await fs.promises.readFile(getMetaPath(root), "utf8");
    const meta = JSON.parse(raw) as IndexMeta;
    return meta.version === 2 ? meta : null;
  } catch {
    return null;
  }
}

async function saveMeta(root: string, meta: IndexMeta): Promise<void> {
  const dir = path.dirname(getMetaPath(root));
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(getMetaPath(root), JSON.stringify(meta, null, 2), "utf8");
}

async function walkChanged(
  root: string,
  dir: string,
  oldHashes: Record<string, string>,
  newHashes: Record<string, string>
): Promise<string[]> {
  const changed: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return changed;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = await walkChanged(root, abs, oldHashes, newHashes);
      changed.push(...sub);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;

    try {
      const stat = await fs.promises.stat(abs);
      if (!stat.isFile() || stat.size > 512_000) continue;
      const fp = fingerprint(stat);
      newHashes[rel] = fp;
      if (oldHashes[rel] !== fp) {
        changed.push(abs);
      }
    } catch {
      // skip
    }
  }
  return changed;
}

// ─── API principal ────────────────────────────────────────────────────────────

export interface IncrementalIndexResult {
  workspaceId: string;
  totalFiles: number;
  changedFiles: number;
  totalChunks: number;
  durationMs: number;
  mode: "full" | "incremental";
}

export async function runIncrementalIndex(root?: string): Promise<IncrementalIndexResult> {
  const wsRoot = root ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) throw new Error("Sin workspace abierto.");

  const t0 = Date.now();
  const workspaceId = path.basename(wsRoot);
  const meta = await loadMeta(wsRoot);

  const newHashes: Record<string, string> = {};
  const changedFiles = await walkChanged(wsRoot, wsRoot, meta?.fileHashes ?? {}, newHashes);

  let mode: "full" | "incremental" = "incremental";

  if (!meta || changedFiles.length > 50) {
    // Reconstrucción completa
    mode = "full";
    await getWorkspaceIndex().forceRebuild();
    await getRagIndex().forceRebuild();
  } else if (changedFiles.length > 0) {
    // Solo actualizar archivos modificados
    const wsIndex = getWorkspaceIndex();
    const ragIndex = getRagIndex();
    for (const absPath of changedFiles) {
      await wsIndex.updateFile(absPath);
      await ragIndex.updateFile(absPath);
    }
  }

  const ragStats = getRagIndex().getStats();

  const newMeta: IndexMeta = {
    version: 2,
    workspaceId,
    lastIndexedAt: new Date().toISOString(),
    fileHashes: newHashes,
    totalFiles: Object.keys(newHashes).length,
    totalChunks: ragStats.chunks,
  };

  await saveMeta(wsRoot, newMeta);

  // Guardar entrada en tech-memory
  try {
    await appendTechMemoryEntry({
      type: "rag",
      title: `Índice incremental (${mode})`,
      summary: `Índice incremental: ${changedFiles.length} archivo(s) actualizados · ${ragStats.chunks} chunks · modo ${mode}`,
      metadata: {
        changedFiles: changedFiles.length,
        totalFiles: newMeta.totalFiles,
        mode,
        workspace: workspaceId,
      },
    });
  } catch {
    // no crítico
  }

  return {
    workspaceId,
    totalFiles: newMeta.totalFiles,
    changedFiles: changedFiles.length,
    totalChunks: ragStats.chunks,
    durationMs: Date.now() - t0,
    mode,
  };
}

// ─── Watcher de archivos ──────────────────────────────────────────────────────

let _watcher: vscode.FileSystemWatcher | undefined;

export function startIncrementalWatcher(context: vscode.ExtensionContext): void {
  if (_watcher) return;

  _watcher = vscode.workspace.createFileSystemWatcher(
    "**/*.{ts,tsx,js,jsx,json,md,py,go,rs,java,cs,sql}"
  );

  const onchange = (uri: vscode.Uri) => {
    if (uri.fsPath.includes("node_modules") || uri.fsPath.includes(".editcore")) return;
    void getWorkspaceIndex().updateFile(uri.fsPath);
    void getRagIndex().updateFile(uri.fsPath);
  };

  _watcher.onDidChange(onchange, null, context.subscriptions);
  _watcher.onDidCreate(onchange, null, context.subscriptions);
  _watcher.onDidDelete((uri) => {
    // Al eliminar solo rebuild completo cuando haya acumulación
    void getRagIndex().updateFile(uri.fsPath);
  }, null, context.subscriptions);

  context.subscriptions.push(_watcher);
}