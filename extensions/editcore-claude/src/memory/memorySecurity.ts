/**
 * Seguridad de memoria — Fase 11 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { redactSecrets } from "../intelligence/redact";
import type { MemoryAuditEntry } from "../knowledge/types";

const AUDIT_LOG = path.join(".editcore", "knowledge", "audit.jsonl");

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /bearer\s+/i,
  /sk-[a-z0-9]{10,}/i,
];

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function containsSensitiveContent(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

export function sanitizeMemoryContent(text: string): string {
  let out = redactSecrets(text);
  if (containsSensitiveContent(out)) {
    out = out.replace(/sk-[a-zA-Z0-9_-]{10,}/g, "[REDACTED_KEY]");
  }
  return out.slice(0, 4000);
}

export async function appendMemoryAudit(
  action: string,
  scope: string,
  detail: string
): Promise<void> {
  const root = workspaceRoot();
  if (!root) return;
  const entry: MemoryAuditEntry = {
    at: new Date().toISOString(),
    action,
    scope,
    detail: sanitizeMemoryContent(detail).slice(0, 500),
  };
  const filePath = path.join(root, AUDIT_LOG);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.appendFile(filePath, JSON.stringify(entry) + "\n", "utf8");
}

export async function purgeProjectKnowledge(root?: string): Promise<number> {
  const ws = root ?? workspaceRoot();
  if (!ws) return 0;
  const knowledgeDir = path.join(ws, ".editcore", "knowledge");
  if (!fs.existsSync(knowledgeDir)) return 0;

  let removed = 0;
  const files = await fs.promises.readdir(knowledgeDir);
  for (const f of files) {
    if (f === "audit.jsonl") continue;
    await fs.promises.unlink(path.join(knowledgeDir, f)).catch(() => undefined);
    removed++;
  }
  await appendMemoryAudit("purge_knowledge", "project", "removed " + removed + " files");
  return removed;
}

export async function listMemoryAudit(limit = 50): Promise<MemoryAuditEntry[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const filePath = path.join(root, AUDIT_LOG);
  if (!fs.existsSync(filePath)) return [];
  const lines = (await fs.promises.readFile(filePath, "utf8")).split("\n").filter(Boolean);
  const entries: MemoryAuditEntry[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      entries.push(JSON.parse(line) as MemoryAuditEntry);
    } catch {
      // skip
    }
  }
  return entries.reverse();
}
