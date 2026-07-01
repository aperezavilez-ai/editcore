/**
 * memoryManager — fachada unificada de memoria persistente EditCore.
 * Consolida project memory, tech-memory, global memory y sesiones sin duplicar almacenes.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { loadProjectMemory, formatMemoryForPrompt, type MemorySection } from "./projectMemory";
import { appendTechMemoryEntry, listTechMemoryEntries } from "../intelligence/techMemoryStore";
import type { TechMemoryEntry } from "../intelligence/techMemoryStore";
import {
  addGlobalMemory,
  searchGlobalMemory,
  type GlobalMemoryEntry,
} from "../global/globalMemory";

export type MemoryRecordType =
  | "architecture"
  | "decision"
  | "prompt"
  | "code_change"
  | "error"
  | "solution"
  | "version"
  | "agent_action";

export interface MemoryRecord {
  id: string;
  type: MemoryRecordType;
  title: string;
  content: string;
  source: "project" | "tech" | "global" | "session";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTraceEntry {
  agent: string;
  action: string;
  result: string;
  timestamp: string;
  success: boolean;
}

const TRACE_FILE = ".editcore/memory/agent-traces.jsonl";

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function mapTechType(type: TechMemoryEntry["type"]): MemoryRecordType {
  const map: Record<TechMemoryEntry["type"], MemoryRecordType> = {
    decision: "decision",
    change: "code_change",
    config: "architecture",
    diagnostic: "error",
    evolution: "version",
    autonomy_cycle: "agent_action",
    rag: "agent_action",
  };
  return map[type] ?? "agent_action";
}

export async function loadUnifiedMemory(): Promise<MemoryRecord[]> {
  const records: MemoryRecord[] = [];
  const projectSections = await loadProjectMemory();
  for (const section of projectSections) {
    records.push({
      id: `project-${section.source}`,
      type: "architecture",
      title: section.source,
      content: section.content.slice(0, 2000),
      source: "project",
      timestamp: new Date().toISOString(),
    });
  }

  const techEntries = await listTechMemoryEntries(30);
  for (const entry of techEntries) {
    records.push({
      id: entry.id,
      type: mapTechType(entry.type),
      title: entry.title,
      content: entry.summary,
      source: "tech",
      timestamp: entry.timestamp,
      metadata: entry.metadata,
    });
  }

  return records;
}

export async function getMemoryContextBlock(): Promise<string> {
  const sections = await loadProjectMemory();
  const projectBlock = formatMemoryForPrompt(sections);
  const tech = await listTechMemoryEntries(5);
  const techBlock =
    tech.length > 0
      ? `\n\nMemoria técnica reciente:\n${tech.map((e) => `- [${e.type}] ${e.title}: ${e.summary}`).join("\n")}`
      : "";
  return projectBlock + techBlock;
}

export async function saveMemoryRecord(
  context: vscode.ExtensionContext,
  record: {
    type: MemoryRecordType;
    title: string;
    content: string;
    scope?: "project" | "tech" | "global";
    metadata?: Record<string, unknown>;
  }
): Promise<MemoryRecord> {
  const scope = record.scope ?? "tech";
  const timestamp = new Date().toISOString();

  if (scope === "global") {
    const globalType =
      record.type === "error"
        ? "error"
        : record.type === "architecture"
          ? "architecture"
          : record.type === "decision"
            ? "pattern"
            : "preference";
    const entry = await addGlobalMemory(context, {
      type: globalType,
      title: record.title,
      content: record.content,
      tags: [record.type],
      projectPath: workspaceRoot(),
      projectName: vscode.workspace.workspaceFolders?.[0]?.name,
    });
    return {
      id: entry.id,
      type: record.type,
      title: record.title,
      content: record.content,
      source: "global",
      timestamp: entry.createdAt,
      metadata: record.metadata,
    };
  }

  if (scope === "project") {
    const root = workspaceRoot();
    if (root) {
      const memPath = path.join(root, ".editcore", "memory.md");
      const line = `\n\n## ${record.title} (${timestamp})\n${record.content}\n`;
      await fs.promises.mkdir(path.dirname(memPath), { recursive: true });
      await fs.promises.appendFile(memPath, line, "utf8");
    }
    return {
      id: `proj-${Date.now()}`,
      type: record.type,
      title: record.title,
      content: record.content,
      source: "project",
      timestamp,
      metadata: record.metadata,
    };
  }

  const techType =
    record.type === "decision"
      ? "decision"
      : record.type === "code_change"
        ? "change"
        : record.type === "version"
          ? "evolution"
          : record.type === "error"
            ? "diagnostic"
            : "config";

  const entry = await appendTechMemoryEntry({
    type: techType,
    title: record.title,
    summary: record.content,
    metadata: record.metadata,
  });

  return {
    id: entry.id,
    type: record.type,
    title: record.title,
    content: record.content,
    source: "tech",
    timestamp: entry.timestamp,
    metadata: record.metadata,
  };
}

export async function recordAgentTrace(
  agent: string,
  action: string,
  result: string,
  success: boolean
): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    return;
  }
  const tracePath = path.join(root, TRACE_FILE);
  await fs.promises.mkdir(path.dirname(tracePath), { recursive: true });
  const entry: AgentTraceEntry = {
    agent,
    action,
    result: result.slice(0, 4000),
    timestamp: new Date().toISOString(),
    success,
  };
  await fs.promises.appendFile(tracePath, JSON.stringify(entry) + "\n", "utf8");
}

export async function listAgentTraces(limit = 50): Promise<AgentTraceEntry[]> {
  const root = workspaceRoot();
  if (!root) {
    return [];
  }
  const tracePath = path.join(root, TRACE_FILE);
  if (!fs.existsSync(tracePath)) {
    return [];
  }
  const lines = (await fs.promises.readFile(tracePath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .slice(-limit);
  return lines.map((l) => JSON.parse(l) as AgentTraceEntry);
}

export async function searchMemory(
  context: vscode.ExtensionContext,
  query: string,
  limit = 10
): Promise<MemoryRecord[]> {
  const unified = await loadUnifiedMemory();
  const q = query.toLowerCase();
  const local = unified
    .filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q)
    )
    .slice(0, limit);

  if (local.length >= limit) {
    return local;
  }

  const globalHits = await searchGlobalMemory(context, query, limit - local.length);
  for (const g of globalHits) {
    local.push({
      id: g.id,
      type: "architecture",
      title: g.title,
      content: g.content,
      source: "global",
      timestamp: g.updatedAt,
    });
  }
  return local;
}

/** Preparado para RAG: exporta entradas como chunks indexables. */
export function memoryRecordsToRagChunks(records: MemoryRecord[]): Array<{ id: string; text: string }> {
  return records.map((r) => ({
    id: r.id,
    text: `[${r.type}] ${r.title}\n${r.content}`,
  }));
}