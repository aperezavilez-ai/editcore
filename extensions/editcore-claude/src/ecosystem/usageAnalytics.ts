/**
 * Analítica de uso — Fase 13 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getCurrentPlanLimits } from "./commercialPlans";
import type { UsageMetrics } from "./types";

const METRICS_FILE = path.join(".editcore", "analytics", "usage.json");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function loadUsageMetrics(): Promise<UsageMetrics> {
  const root = workspaceRoot();
  const defaults: UsageMetrics = {
    projectsCreated: 0,
    agentsUsed: 0,
    tasksCompleted: 0,
    aiTokensEstimate: 0,
    timeSavedMinutes: 0,
    lastUpdated: new Date().toISOString(),
  };
  if (!root) return defaults;
  const file = path.join(root, METRICS_FILE);
  if (!fs.existsSync(file)) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(await fs.promises.readFile(file, "utf8")) as UsageMetrics) };
  } catch {
    return defaults;
  }
}

async function saveMetrics(m: UsageMetrics): Promise<void> {
  const root = workspaceRoot();
  if (!root) return;
  m.lastUpdated = new Date().toISOString();
  const dir = path.dirname(path.join(root, METRICS_FILE));
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(root, METRICS_FILE), JSON.stringify(m, null, 2) + "\n", "utf8");
}

export async function trackUsage(event: keyof Pick<UsageMetrics, "agentsUsed" | "tasksCompleted" | "projectsCreated">, delta = 1): Promise<void> {
  const limits = await getCurrentPlanLimits();
  if (!limits.analytics && event !== "agentsUsed") {
    // still track basic counters locally
  }
  const m = await loadUsageMetrics();
  m[event] += delta;
  if (event === "tasksCompleted") {
    m.timeSavedMinutes += 15 * delta;
    m.aiTokensEstimate += 8000 * delta;
  }
  await saveMetrics(m);
}

export function formatUsageReport(m: UsageMetrics): string {
  return [
    "# Analítica EditCore",
    "",
    "**Actualizado:** " + m.lastUpdated,
    "",
    "| Métrica | Valor |",
    "|---------|-------|",
    "| Proyectos creados | " + m.projectsCreated + " |",
    "| Agentes usados | " + m.agentsUsed + " |",
    "| Tareas completadas | " + m.tasksCompleted + " |",
    "| Tokens IA (est.) | " + m.aiTokensEstimate + " |",
    "| Tiempo ahorrado (min) | " + m.timeSavedMinutes + " |",
  ].join("\n");
}
