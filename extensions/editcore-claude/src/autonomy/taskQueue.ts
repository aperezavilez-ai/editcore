import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { HealthReport, SystemSnapshot } from "../intelligence/types";
import type { AutonomyQueue, AutonomyTask } from "./types";

const AUTONOMY_DIR = ".editcore/autonomy";

function getAutonomyDir(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  return path.join(folder.uri.fsPath, AUTONOMY_DIR);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function formatCursorPromptsMarkdown(tasks: AutonomyTask[]): string {
  const pending = tasks.filter((t) => t.status === "pending");
  const lines = [
    "# EditCore — prompts para Cursor (autonomía real)",
    "",
    `_Generado: ${new Date().toISOString()}_`,
    "",
    "Copia cada bloque en Cursor Agent. Son tareas derivadas de **datos reales** del IDE, no simulación.",
    "",
  ];

  if (pending.length === 0) {
    lines.push("_Sin tareas pendientes._");
    return lines.join("\n");
  }

  for (const [i, task] of pending.entries()) {
    lines.push(`---`, "", `## ${i + 1}. ${task.title}`, "", "```markdown", task.cursorPrompt, "```", "");
  }

  return lines.join("\n");
}

export async function saveAutonomyQueue(
  snapshot: SystemSnapshot,
  health: HealthReport,
  tasks: AutonomyTask[]
): Promise<{ queuePath?: string; cursorPromptPath?: string; reportPath?: string }> {
  const dir = getAutonomyDir();
  if (!dir) {
    return {};
  }

  ensureDir(dir);

  const queue: AutonomyQueue = {
    version: 1,
    generatedAt: new Date().toISOString(),
    productVersion: snapshot.productVersion,
    extensionVersion: snapshot.extensionVersion,
    healthStatus: health.status,
    workspacePath: snapshot.workspacePath,
    tasks,
  };

  const queuePath = path.join(dir, "queue.json");
  const cursorPromptPath = path.join(dir, "cursor-prompts.md");
  const reportPath = path.join(dir, "latest-report.md");

  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + "\n", "utf8");
  fs.writeFileSync(cursorPromptPath, formatCursorPromptsMarkdown(tasks) + "\n", "utf8");

  return { queuePath, cursorPromptPath, reportPath };
}

export async function loadAutonomyQueue(): Promise<AutonomyQueue | undefined> {
  const dir = getAutonomyDir();
  if (!dir) {
    return undefined;
  }
  const queuePath = path.join(dir, "queue.json");
  if (!fs.existsSync(queuePath)) {
    return undefined;
  }
  const raw = fs.readFileSync(queuePath, "utf8");
  return JSON.parse(raw) as AutonomyQueue;
}

export async function markTaskStatus(
  taskId: string,
  status: AutonomyTask["status"]
): Promise<boolean> {
  const queue = await loadAutonomyQueue();
  if (!queue) {
    return false;
  }
  const task = queue.tasks.find((t) => t.id === taskId);
  if (!task) {
    return false;
  }
  task.status = status;
  const dir = getAutonomyDir();
  if (!dir) {
    return false;
  }
  fs.writeFileSync(path.join(dir, "queue.json"), JSON.stringify(queue, null, 2) + "\n", "utf8");
  return true;
}
