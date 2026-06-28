/**
 * Registro de ejecución — Fase 5 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import type { ExecutionLogEntry } from "./types";

const LOG_DIR = path.join(".editcore", "autonomous");
const LOG_FILE = "execution-log.jsonl";

export async function appendExecutionLog(
  root: string,
  entry: Omit<ExecutionLogEntry, "at"> & { at?: string }
): Promise<void> {
  const dir = path.join(root, LOG_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  const line: ExecutionLogEntry = {
    at: entry.at ?? new Date().toISOString(),
    taskId: entry.taskId,
    phase: entry.phase,
    action: entry.action,
    detail: entry.detail.slice(0, 2000),
    success: entry.success,
  };
  await fs.promises.appendFile(path.join(dir, LOG_FILE), JSON.stringify(line) + "\n", "utf8");
}

export async function readExecutionLog(root: string, limit = 50): Promise<ExecutionLogEntry[]> {
  const filePath = path.join(root, LOG_DIR, LOG_FILE);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = await fs.promises.readFile(filePath, "utf8");
  const lines = raw.trim().split("\n").filter(Boolean);
  const entries: ExecutionLogEntry[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      entries.push(JSON.parse(line) as ExecutionLogEntry);
    } catch {
      // skip corrupt line
    }
  }
  return entries;
}

export function formatExecutionLogMarkdown(entries: ExecutionLogEntry[]): string {
  const lines = [
    "# Historial de ejecución autónoma",
    "",
    "_EditCore Autonomous Developer Engine_",
    "",
  ];
  if (entries.length === 0) {
    lines.push("_Sin ejecuciones registradas._");
    return lines.join("\n");
  }
  for (const e of entries.reverse()) {
    lines.push(
      "## " + e.at + " — " + e.taskId,
      "",
      "- **Fase:** " + e.phase,
      "- **Acción:** " + e.action,
      "- **Estado:** " + (e.success ? "OK" : "FAIL"),
      "",
      e.detail.slice(0, 500),
      ""
    );
  }
  return lines.join("\n");
}
