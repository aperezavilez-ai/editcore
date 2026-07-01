import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { redactSecrets } from "./redact";

export interface TechMemoryEntry {
  id: string;
  timestamp: string;
  type: "decision" | "change" | "config" | "diagnostic" | "evolution" | "autonomy_cycle" | "rag";
  title: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

interface TechMemoryIndex {
  version: number;
  entries: Array<{ id: string; file: string; timestamp: string; title: string; type: string }>;
}

function techMemoryRoot(): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  return path.join(root, ".editcore", "tech-memory");
}

function indexPath(root: string): string {
  return path.join(root, "index.json");
}

async function readIndex(root: string): Promise<TechMemoryIndex> {
  try {
    const raw = await fs.promises.readFile(indexPath(root), "utf8");
    return JSON.parse(raw) as TechMemoryIndex;
  } catch {
    return { version: 1, entries: [] };
  }
}

async function writeIndex(root: string, index: TechMemoryIndex): Promise<void> {
  await fs.promises.writeFile(indexPath(root), JSON.stringify(index, null, 2), "utf8");
}

export async function appendTechMemoryEntry(
  entry: Omit<TechMemoryEntry, "id" | "timestamp"> & { timestamp?: string }
): Promise<TechMemoryEntry> {
  const root = techMemoryRoot();
  if (!root) {
    throw new Error("Abre un workspace para guardar memoria técnica.");
  }

  await fs.promises.mkdir(path.join(root, "entries"), { recursive: true });

  const full: TechMemoryEntry = {
    id: crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    type: entry.type,
    title: entry.title,
    summary: entry.summary,
    metadata: entry.metadata ? (redactSecrets(entry.metadata) as Record<string, unknown>) : undefined,
  };

  const fileName = `${full.timestamp.slice(0, 10)}-${full.id.slice(0, 8)}.json`;
  const filePath = path.join(root, "entries", fileName);
  await fs.promises.writeFile(filePath, JSON.stringify(full, null, 2), "utf8");

  const index = await readIndex(root);
  index.entries.unshift({
    id: full.id,
    file: path.join("entries", fileName),
    timestamp: full.timestamp,
    title: full.title,
    type: full.type,
  });
  index.entries = index.entries.slice(0, 200);
  await writeIndex(root, index);
  await regenerateTechMemoryTimeline(root, index);

  return full;
}

async function regenerateTechMemoryTimeline(root: string, index: TechMemoryIndex): Promise<void> {
  const lines = [
    "# EditCore Tech Memory",
    "",
    `_Actualizado: ${new Date().toISOString()}_`,
    "",
  ];

  for (const item of index.entries.slice(0, 50)) {
    lines.push(`- **${item.timestamp}** [${item.type}] ${item.title}`);
  }

  await fs.promises.writeFile(path.join(root, "timeline.md"), lines.join("\n"), "utf8");
}

export async function listTechMemoryEntries(limit = 20): Promise<TechMemoryEntry[]> {
  const root = techMemoryRoot();
  if (!root) {
    return [];
  }

  const index = await readIndex(root);
  const results: TechMemoryEntry[] = [];

  for (const item of index.entries.slice(0, limit)) {
    try {
      const raw = await fs.promises.readFile(path.join(root, item.file), "utf8");
      results.push(JSON.parse(raw) as TechMemoryEntry);
    } catch {
      // skip corrupt entry
    }
  }

  return results;
}