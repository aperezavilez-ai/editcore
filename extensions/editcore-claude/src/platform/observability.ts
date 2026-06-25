import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type ObservabilityLevel = "info" | "warn" | "error" | "metric";

export interface ObservabilityEntry {
  ts: string;
  level: ObservabilityLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

function logPath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "observability.jsonl");
}

export async function logEvent(
  context: vscode.ExtensionContext,
  level: ObservabilityLevel,
  category: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  const entry: ObservabilityEntry = {
    ts: new Date().toISOString(),
    level,
    category,
    message,
    data,
  };
  try {
    await fs.promises.mkdir(path.dirname(logPath(context)), { recursive: true });
    await fs.promises.appendFile(logPath(context), JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // best effort
  }
}

export async function readRecentEvents(
  context: vscode.ExtensionContext,
  limit = 50
): Promise<ObservabilityEntry[]> {
  try {
    const raw = await fs.promises.readFile(logPath(context), "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as ObservabilityEntry)
      .reverse();
  } catch {
    return [];
  }
}

export function formatObservabilityReport(entries: ObservabilityEntry[]): string {
  const lines = ["# Observabilidad EditCore", ""];
  for (const e of entries) {
    lines.push(`- [${e.ts}] **${e.level}** ${e.category}: ${e.message}`);
  }
  return lines.join("\n");
}
