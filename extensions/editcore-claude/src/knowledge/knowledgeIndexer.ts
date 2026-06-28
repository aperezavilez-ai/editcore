/**
 * Indexación inteligente — Fase 2 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { loadUnifiedMemory, memoryRecordsToRagChunks } from "../memory/memoryManager";
import { listChangeRecords } from "../memory/changeMemory";
import { getRagIndex } from "../rag/chunkIndex";
import { getWorkspaceIndex } from "../index/workspaceIndex";
import { writeProjectKnowledgeMap } from "./projectKnowledgeEngine";
import type { KnowledgeIndexMeta } from "./types";

const META_PATH = path.join(".editcore", "knowledge", "index-meta.json");
const MEMORY_INDEX = path.join(".editcore", "knowledge", "memory-chunks.json");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function runKnowledgeIndexing(): Promise<KnowledgeIndexMeta> {
  const root = workspaceRoot();
  if (!root) {
    throw new Error("Sin workspace.");
  }

  await getWorkspaceIndex().forceRebuild();
  await getRagIndex().forceRebuild();
  await writeProjectKnowledgeMap(root);

  const memoryRecords = await loadUnifiedMemory();
  const memChunks = memoryRecordsToRagChunks(memoryRecords);
  await fs.promises.mkdir(path.dirname(path.join(root, MEMORY_INDEX)), { recursive: true });
  await fs.promises.writeFile(path.join(root, MEMORY_INDEX), JSON.stringify(memChunks, null, 2) + "\n", "utf8");

  let logEntries = 0;
  const logsDir = path.join(root, ".editcore", "reports");
  if (fs.existsSync(logsDir)) {
    logEntries = fs.readdirSync(logsDir).filter((f) => f.endsWith(".md")).length;
  }

  const changes = await listChangeRecords(root, 500);

  let codeChunks = 0;
  const ragPath = path.join(root, ".editcore", "rag", "index.json");
  if (fs.existsSync(ragPath)) {
    try {
      const rag = JSON.parse(fs.readFileSync(ragPath, "utf8")) as { chunks?: unknown[] };
      codeChunks = rag.chunks?.length ?? 0;
    } catch {
      codeChunks = 0;
    }
  }

  const meta: KnowledgeIndexMeta = {
    version: 1,
    updatedAt: new Date().toISOString(),
    codeChunks,
    memoryRecords: memoryRecords.length,
    docChunks: memChunks.length,
    logEntries,
    changeEntries: changes.length,
  };

  await fs.promises.mkdir(path.dirname(path.join(root, META_PATH)), { recursive: true });
  await fs.promises.writeFile(path.join(root, META_PATH), JSON.stringify(meta, null, 2) + "\n", "utf8");

  return meta;
}

export async function loadIndexMeta(root?: string): Promise<KnowledgeIndexMeta | undefined> {
  const ws = root ?? workspaceRoot();
  if (!ws) return undefined;
  const file = path.join(ws, META_PATH);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8")) as KnowledgeIndexMeta;
  } catch {
    return undefined;
  }
}
