/**
 * Memoria de conversaciones — Fase 4 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { redactSecrets } from "../intelligence/redact";
import { appendMemoryAudit } from "./memorySecurity";

const CONV_DIR = path.join(".editcore", "knowledge", "conversations");
const INDEX_FILE = "index.json";

export interface ConversationMemoryEntry {
  id: string;
  at: string;
  summary: string;
  importance: "high" | "medium" | "low";
  tags: string[];
  source: "chat" | "agent" | "manual";
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function isImportant(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("decid") ||
    lower.includes("importante") ||
    lower.includes("siempre") ||
    lower.includes("nunca") ||
    lower.includes("arquitectura") ||
    lower.includes("prefer") ||
    lower.includes("error") ||
    lower.includes("solucion")
  );
}

export async function recordConversationMemory(input: {
  summary: string;
  source?: "chat" | "agent" | "manual";
  force?: boolean;
}): Promise<ConversationMemoryEntry | undefined> {
  const root = workspaceRoot();
  if (!root) {
    return undefined;
  }

  const clean = redactSecrets(input.summary).slice(0, 2000);
  if (!input.force && clean.length < 40) {
    return undefined;
  }

  const importance: ConversationMemoryEntry["importance"] = isImportant(clean)
    ? "high"
    : clean.length > 200
      ? "medium"
      : "low";

  if (!input.force && importance === "low") {
    return undefined;
  }

  const entry: ConversationMemoryEntry = {
    id: "conv-" + Date.now(),
    at: new Date().toISOString(),
    summary: clean,
    importance,
    tags: [],
    source: input.source ?? "chat",
  };

  const dir = path.join(root, CONV_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  const indexPath = path.join(dir, INDEX_FILE);
  let list: ConversationMemoryEntry[] = [];
  if (fs.existsSync(indexPath)) {
    try {
      list = JSON.parse(await fs.promises.readFile(indexPath, "utf8")) as ConversationMemoryEntry[];
    } catch {
      list = [];
    }
  }
  list.unshift(entry);
  if (list.length > 200) {
    list = list.slice(0, 200);
  }
  await fs.promises.writeFile(indexPath, JSON.stringify(list, null, 2) + "\n", "utf8");
  await appendMemoryAudit("conversation_saved", "project", entry.id);
  return entry;
}

export async function listConversationMemory(limit = 20): Promise<ConversationMemoryEntry[]> {
  const root = workspaceRoot();
  if (!root) {
    return [];
  }
  const indexPath = path.join(root, CONV_DIR, INDEX_FILE);
  if (!fs.existsSync(indexPath)) {
    return [];
  }
  try {
    const list = JSON.parse(await fs.promises.readFile(indexPath, "utf8")) as ConversationMemoryEntry[];
    return list
      .filter((e) => e.importance !== "low")
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getConversationContextBlock(): Promise<string> {
  const entries = await listConversationMemory(8);
  if (entries.length === 0) {
    return "";
  }
  const lines = ["## Conversaciones relevantes", ""];
  for (const e of entries) {
    lines.push("- [" + e.importance + "] " + e.summary.slice(0, 300));
  }
  return lines.join("\n");
}
