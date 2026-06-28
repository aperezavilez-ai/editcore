/**
 * Memoria de arquitectura — Fase 5 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { buildDependencyGraph } from "../twin/dependencyGraph";
import { listArchitectureModules } from "../intelligence/architectureScanner";

const ARCH_FILE = path.join(".editcore", "knowledge", "architecture-memory.json");

export interface ArchitectureMemoryStore {
  version: 1;
  updatedAt: string;
  components: Array<{ id: string; name: string; role: string; path: string }>;
  relations: Array<{ from: string; to: string; kind: string }>;
  patterns: string[];
  decisions: Array<{ at: string; title: string; detail: string }>;
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function refreshArchitectureMemory(extensionPath: string): Promise<ArchitectureMemoryStore> {
  const root = workspaceRoot();
  if (!root) {
    throw new Error("Sin workspace.");
  }

  const modules = listArchitectureModules(extensionPath);
  const components = modules.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    path: m.path,
  }));

  const relations: ArchitectureMemoryStore["relations"] = [];
  try {
    const graph = await buildDependencyGraph();
    for (const node of graph.nodes ?? []) {
      for (const imp of node.imports.slice(0, 5)) {
        relations.push({ from: node.id, to: imp, kind: "import" });
      }
    }
  } catch {
    // optional
  }

  const store: ArchitectureMemoryStore = {
    version: 1,
    updatedAt: new Date().toISOString(),
    components,
    relations: relations.slice(0, 100),
    patterns: ["extension-host", "agent-loop", "rag-index", "orchestrator-middleware"],
    decisions: [],
  };

  const existing = await loadArchitectureMemory();
  if (existing?.decisions.length) {
    store.decisions = existing.decisions.slice(0, 50);
  }

  const filePath = path.join(root, ARCH_FILE);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(store, null, 2) + "\n", "utf8");
  return store;
}

export async function loadArchitectureMemory(): Promise<ArchitectureMemoryStore | undefined> {
  const root = workspaceRoot();
  if (!root) return undefined;
  const filePath = path.join(root, ARCH_FILE);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as ArchitectureMemoryStore;
  } catch {
    return undefined;
  }
}

export async function recordArchitectureDecision(title: string, detail: string): Promise<void> {
  const root = workspaceRoot();
  if (!root) return;
  let store = await loadArchitectureMemory();
  if (!store) {
    store = {
      version: 1,
      updatedAt: new Date().toISOString(),
      components: [],
      relations: [],
      patterns: [],
      decisions: [],
    };
  }
  store.decisions.unshift({
    at: new Date().toISOString(),
    title: title.slice(0, 120),
    detail: detail.slice(0, 2000),
  });
  store.decisions = store.decisions.slice(0, 50);
  store.updatedAt = new Date().toISOString();
  const filePath = path.join(root, ARCH_FILE);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export async function getArchitectureContext(query?: string): Promise<string> {
  const store = await loadArchitectureMemory();
  if (!store) {
    return "";
  }
  const q = query?.toLowerCase() ?? "";
  const relevant = store.components.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
  );

  const lines = [
    "## Memoria de arquitectura",
    "",
    "### Componentes (" + store.components.length + ")",
  ];
  for (const c of (relevant.length ? relevant : store.components).slice(0, 12)) {
    lines.push("- **" + c.name + "**: " + c.role + " (`" + c.path + "`)");
  }
  if (store.decisions.length) {
    lines.push("", "### Decisiones recientes");
    for (const d of store.decisions.slice(0, 5)) {
      lines.push("- " + d.title + ": " + d.detail.slice(0, 150));
    }
  }
  return lines.join("\n");
}
