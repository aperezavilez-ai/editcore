import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface GlobalMemoryEntry {
  id: string;
  type: "architecture" | "api" | "error" | "pattern" | "preference" | "component";
  projectPath?: string;
  projectName?: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GlobalMemoryStore {
  version: 1;
  entries: GlobalMemoryEntry[];
  updatedAt: string;
}

function storePath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "global-memory.json");
}

async function loadStore(context: vscode.ExtensionContext): Promise<GlobalMemoryStore> {
  const file = storePath(context);
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    return JSON.parse(raw) as GlobalMemoryStore;
  } catch {
    return { version: 1, entries: [], updatedAt: new Date().toISOString() };
  }
}

async function saveStore(context: vscode.ExtensionContext, store: GlobalMemoryStore): Promise<void> {
  await fs.promises.mkdir(path.dirname(storePath(context)), { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.promises.writeFile(storePath(context), JSON.stringify(store, null, 2), "utf8");
}

export async function addGlobalMemory(
  context: vscode.ExtensionContext,
  entry: Omit<GlobalMemoryEntry, "id" | "createdAt" | "updatedAt">
): Promise<GlobalMemoryEntry> {
  const store = await loadStore(context);
  const full: GlobalMemoryEntry = {
    ...entry,
    id: `mem-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.entries.unshift(full);
  if (store.entries.length > 500) store.entries = store.entries.slice(0, 500);
  await saveStore(context, store);
  return full;
}

export async function searchGlobalMemory(
  context: vscode.ExtensionContext,
  query: string,
  limit = 10
): Promise<GlobalMemoryEntry[]> {
  const store = await loadStore(context);
  const q = query.toLowerCase();
  return store.entries
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

export async function getGlobalMemoryContext(
  context: vscode.ExtensionContext,
  query: string
): Promise<string> {
  const hits = await searchGlobalMemory(context, query, 5);
  if (!hits.length) return "";
  const lines = hits.map(
    (h) => `- [${h.type}] ${h.title} (${h.projectName ?? "global"}): ${h.content.slice(0, 200)}`
  );
  return `## Memoria global EditCore\n${lines.join("\n")}`;
}

export async function syncWorkspaceMemoryToGlobal(
  context: vscode.ExtensionContext
): Promise<number> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return 0;

  const memPath = path.join(folder.uri.fsPath, ".editcore", "memory.md");
  if (!fs.existsSync(memPath)) return 0;

  const content = fs.readFileSync(memPath, "utf8").trim();
  if (!content || content.length < 20) return 0;

  const store = await loadStore(context);
  const hash = `${folder.uri.fsPath}:${content.length}`;
  const exists = store.entries.some((e) => e.tags.includes(hash));
  if (exists) return 0;

  await addGlobalMemory(context, {
    type: "pattern",
    projectPath: folder.uri.fsPath,
    projectName: folder.name,
    title: `Memoria de ${folder.name}`,
    content: content.slice(0, 2000),
    tags: [hash, "workspace-sync"],
  });
  return 1;
}

export async function listGlobalMemory(
  context: vscode.ExtensionContext
): Promise<GlobalMemoryEntry[]> {
  const store = await loadStore(context);
  return store.entries;
}
