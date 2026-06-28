/**
 * Cola persistente de tareas autónomas — Fase 1/11 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import type { PhaseResult, TaskEngineResult, WorkMode } from "./types";

const STORE_DIR = path.join(".editcore", "autonomous");
const STORE_FILE = "tasks.json";

export type StoredTaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface StoredAutonomousTask {
  id: string;
  objective: string;
  status: StoredTaskStatus;
  workMode: WorkMode;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  success?: boolean;
  phases?: PhaseResult[];
  artifacts?: {
    projectUnderstanding?: string;
    plan?: string;
    completionReport?: string;
    improvementPlan?: string;
  };
  gitBranch?: string;
  explanation?: string;
}

export interface TaskStore {
  version: 1;
  updatedAt: string;
  tasks: StoredAutonomousTask[];
}

function storePath(root: string): string {
  return path.join(root, STORE_DIR, STORE_FILE);
}

export async function loadTaskStore(root: string): Promise<TaskStore> {
  const file = storePath(root);
  if (!fs.existsSync(file)) {
    return { version: 1, updatedAt: new Date().toISOString(), tasks: [] };
  }
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    return JSON.parse(raw) as TaskStore;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), tasks: [] };
  }
}

async function saveTaskStore(root: string, store: TaskStore): Promise<void> {
  const dir = path.join(root, STORE_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.promises.writeFile(storePath(root), JSON.stringify(store, null, 2) + "\n", "utf8");
}

export async function createPendingTask(
  root: string,
  objective: string,
  workMode: WorkMode
): Promise<StoredAutonomousTask> {
  const store = await loadTaskStore(root);
  const task: StoredAutonomousTask = {
    id: "ade-" + Date.now(),
    objective,
    status: "pending",
    workMode,
    createdAt: new Date().toISOString(),
  };
  store.tasks.unshift(task);
  if (store.tasks.length > 100) {
    store.tasks = store.tasks.slice(0, 100);
  }
  await saveTaskStore(root, store);
  return task;
}

export async function markTaskInProgress(root: string, taskId: string): Promise<void> {
  const store = await loadTaskStore(root);
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) {
    return;
  }
  task.status = "in_progress";
  task.startedAt = new Date().toISOString();
  await saveTaskStore(root, store);
}

export async function saveTaskResult(root: string, result: TaskEngineResult): Promise<void> {
  const store = await loadTaskStore(root);
  let task = store.tasks.find((t) => t.id === result.taskId);
  if (!task) {
    task = {
      id: result.taskId,
      objective: result.objective,
      status: "completed",
      workMode: result.workMode,
      createdAt: result.startedAt,
    };
    store.tasks.unshift(task);
  }
  task.status = result.success ? "completed" : "failed";
  task.completedAt = result.completedAt;
  task.success = result.success;
  task.phases = result.phases;
  task.gitBranch = result.gitBranch;
  task.artifacts = {
    projectUnderstanding: result.projectUnderstandingPath,
    plan: result.planPath,
    completionReport: result.completionReportPath,
    improvementPlan: result.improvementPlanPath,
  };
  task.explanation = result.phases
    .map((p) => p.phase + ": " + (p.success ? "OK" : "FAIL"))
    .join(" → ");
  await saveTaskStore(root, store);
  if (result.success) {
    void import("../ecosystem/usageAnalytics").then((m) => m.trackUsage("tasksCompleted"));
  }
}

export async function updateTaskStatus(
  root: string,
  taskId: string,
  status: StoredTaskStatus
): Promise<void> {
  const store = await loadTaskStore(root);
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) {
    return;
  }
  task.status = status;
  if (status === "cancelled" || status === "completed") {
    task.completedAt = new Date().toISOString();
  }
  await saveTaskStore(root, store);
}

export async function getRecentTasks(root: string, limit = 20): Promise<StoredAutonomousTask[]> {
  const store = await loadTaskStore(root);
  return store.tasks.slice(0, limit);
}

export async function getNextPendingTask(root: string): Promise<StoredAutonomousTask | undefined> {
  const store = await loadTaskStore(root);
  return store.tasks.find((t) => t.status === "pending");
}
