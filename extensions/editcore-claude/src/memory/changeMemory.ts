/**
 * Memoria de cambios — Fase 6 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";

const execAsync = promisify(exec);
const CHANGE_LOG = path.join(".editcore", "knowledge", "changes.jsonl");

export interface ChangeMemoryRecord {
  id: string;
  at: string;
  who: string;
  what: string;
  why: string;
  files: string[];
  result: "success" | "partial" | "failed";
  gitCommit?: string;
  summary: string;
  problems?: string[];
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function gitUser(root: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git config user.name", { cwd: root });
    return stdout.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function recordChangeMemory(input: {
  what: string;
  why: string;
  files: string[];
  result: ChangeMemoryRecord["result"];
  problems?: string[];
}): Promise<ChangeMemoryRecord> {
  const root = workspaceRoot();
  if (!root) {
    throw new Error("Sin workspace.");
  }

  let gitCommit: string | undefined;
  try {
    const { stdout } = await execAsync("git rev-parse --short HEAD", { cwd: root });
    gitCommit = stdout.trim();
  } catch {
    gitCommit = undefined;
  }

  const record: ChangeMemoryRecord = {
    id: "chg-" + Date.now(),
    at: new Date().toISOString(),
    who: await gitUser(root),
    what: input.what.slice(0, 500),
    why: input.why.slice(0, 500),
    files: input.files.slice(0, 30),
    result: input.result,
    gitCommit,
    summary: input.what.slice(0, 200) + " — " + input.result,
    problems: input.problems,
  };

  const filePath = path.join(root, CHANGE_LOG);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.appendFile(filePath, JSON.stringify(record) + "\n", "utf8");
  return record;
}

export async function listChangeRecords(root?: string, limit = 50): Promise<ChangeMemoryRecord[]> {
  const ws = root ?? workspaceRoot();
  if (!ws) return [];
  const filePath = path.join(ws, CHANGE_LOG);
  if (!fs.existsSync(filePath)) return [];
  const lines = (await fs.promises.readFile(filePath, "utf8")).split("\n").filter(Boolean);
  const records: ChangeMemoryRecord[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      records.push(JSON.parse(line) as ChangeMemoryRecord);
    } catch {
      // skip
    }
  }
  return records.reverse();
}

export async function searchChangeMemory(query: string, limit = 5): Promise<ChangeMemoryRecord[]> {
  const q = query.toLowerCase();
  const all = await listChangeRecords(undefined, 100);
  return all
    .filter(
      (r) =>
        r.what.toLowerCase().includes(q) ||
        r.why.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export async function syncChangeMemoryFromGit(): Promise<number> {
  const root = workspaceRoot();
  if (!root) return 0;
  try {
    const { stdout } = await execAsync("git log -5 --name-only --pretty=format:%h|%an|%s", { cwd: root });
    let count = 0;
    for (const block of stdout.split("\n\n").filter(Boolean)) {
      const lines = block.split("\n");
      const header = lines[0]?.split("|") ?? [];
      const files = lines.slice(1).filter(Boolean);
      if (header.length >= 3) {
        await recordChangeMemory({
          what: header[2] ?? "commit",
          why: "sync desde git " + header[0],
          files,
          result: "success",
        });
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}
