import * as fs from "fs";
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { logEvent } from "../platform/observability";
import { writeSystemMapToWorkspace } from "../intelligence/docGenerator";
import { buildHealthReport } from "../intelligence/healthMonitor";
import { buildLocalAnalysis } from "../intelligence/localAnalysis";
import { requestPermission } from "../intelligence/permissionGate";
import { buildSystemSnapshot } from "../intelligence/systemReader";
import { appendTechMemoryEntry } from "../intelligence/techMemoryStore";
import { buildAgentExecutionPrompt, planAutonomyTasks } from "./taskPlanner";
import { saveAutonomyQueue } from "./taskQueue";
import type { AutonomyCycleResult } from "./types";

function formatAutonomyMarkdown(
  result: Omit<AutonomyCycleResult, "markdown">,
  localAnalysis: string
): string {
  const { snapshot, health, tasks, queuePath, cursorPromptPath, savedMapPath } = result;
  const statusEmoji =
    health.status === "healthy" ? "✅" : health.status === "degraded" ? "⚠️" : "❌";

  const lines: string[] = [
    "# Autonomía real EditCore",
    "",
    `_Generado: ${result.generatedAt}_`,
    `_Producto v${snapshot.productVersion} · extensión v${snapshot.extensionVersion}_`,
    "",
    "> **Pipeline real** — lectura directa del IDE, tareas derivadas de hallazgos, sin role-play.",
    "",
    `## Estado: ${statusEmoji} ${health.status}`,
    "",
    localAnalysis,
    "",
    "---",
    "",
    "## Tareas concretas (cola de automejora)",
    "",
  ];

  const pending = tasks.filter((t) => t.status === "pending");
  if (pending.length === 0) {
    lines.push("_No hay tareas pendientes. El sistema está en buen estado o ya se procesaron._");
  } else {
    for (const [i, task] of pending.entries()) {
      lines.push(
        `### ${i + 1}. ${task.title}`,
        "",
        `- **ID:** \`${task.id}\``,
        `- **Tipo:** ${task.kind}`,
        `- **Evidencia:** ${task.evidence}`,
        `- **Ejecutable por agente:** ${task.autoExecutable ? "sí" : "requiere usuario"}`,
        ""
      );
    }
  }

  lines.push("", "---", "", "## Archivos generados", "");
  if (queuePath) {
    lines.push(`- Cola JSON: \`${queuePath.replace(/\\/g, "/")}\``);
  }
  if (cursorPromptPath) {
    lines.push(`- Prompts Cursor: \`${cursorPromptPath.replace(/\\/g, "/")}\``);
  }
  if (savedMapPath) {
    lines.push(`- Mapa del sistema: \`${savedMapPath.replace(/\\/g, "/")}\``);
  }

  lines.push(
    "",
    "## Cómo ejecutar",
    "",
    "1. **En EditCore (Agent):** escribe `ejecuta las tareas de autonomía` — el agente usará herramientas reales.",
    "2. **En Cursor:** abre `.editcore/autonomy/cursor-prompts.md` y pega cada bloque aquí.",
    "3. **Comando:** `editcore.autonomy.execute` para la siguiente tarea pendiente.",
    "",
    "**Comandos:** `editcore.autonomy.diagnose` · `editcore.autonomy.openQueue` · `editcore.intelligence.health`"
  );

  return lines.join("\n");
}

export function isAutonomyEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("autonomy.enabled", true);
}

export async function runAutonomyCycle(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  options: { saveSystemMap?: boolean; recordMemory?: boolean } = {}
): Promise<AutonomyCycleResult> {
  if (!isAutonomyEnabled()) {
    throw new Error("Autonomía desactivada. Activa editcore.autonomy.enabled en settings.");
  }

  const config = vscode.workspace.getConfiguration("editcore");
  const saveSystemMap =
    options.saveSystemMap ?? config.get<boolean>("intelligence.autoGenerateMap", true);
  const recordMemory =
    options.recordMemory ?? config.get<boolean>("intelligence.techMemory.enabled", true);

  const [snapshot, health] = await Promise.all([
    buildSystemSnapshot(context, apiKeyService),
    buildHealthReport(context, apiKeyService),
  ]);

  const tasks = planAutonomyTasks({
    snapshot,
    health,
    findings: health.findings,
  });

  const paths = await saveAutonomyQueue(snapshot, health, tasks);

  let savedMapPath: string | undefined;
  if (saveSystemMap && vscode.workspace.workspaceFolders?.length) {
    const allowed = await requestPermission(
      "write_docs",
      "Guardar EDITCORE_SYSTEM_MAP.md durante autonomía"
    );
    if (allowed) {
      const saved = await writeSystemMapToWorkspace(snapshot, health);
      savedMapPath = saved.workspacePath;
    }
  }

  const generatedAt = new Date().toISOString();
  const localAnalysis = buildLocalAnalysis(snapshot, health);

  const partial: Omit<AutonomyCycleResult, "markdown"> = {
    generatedAt,
    tasks,
    snapshot,
    health,
    queuePath: paths.queuePath,
    cursorPromptPath: paths.cursorPromptPath,
    reportPath: paths.reportPath,
    savedMapPath,
  };

  const markdown = formatAutonomyMarkdown(partial, localAnalysis);

  if (paths.reportPath) {
    fs.writeFileSync(paths.reportPath, markdown + "\n", "utf8");
  }

  if (recordMemory && vscode.workspace.workspaceFolders?.length) {
    const allowed = await requestPermission(
      "write_docs",
      "Registrar ciclo de autonomía en tech-memory"
    );
    if (allowed) {
      await appendTechMemoryEntry({
        type: "autonomy_cycle",
        title: `Autonomía — ${health.status}`,
        summary: `${tasks.filter((t) => t.status === "pending").length} tareas pendientes. Producto v${snapshot.productVersion}.`,
        metadata: {
          healthStatus: health.status,
          taskCount: tasks.length,
          queuePath: paths.queuePath,
        },
      });
    }
  }

  await logEvent(context, "info", "autonomy", "cycle_completed", {
    status: health.status,
    tasks: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
  });

  return { ...partial, markdown };
}

export async function getAutonomyExecutionPrompt(maxTasks?: number): Promise<string> {
  const { loadAutonomyQueue } = await import("./taskQueue");
  const queue = await loadAutonomyQueue();
  if (!queue) {
    return buildAgentExecutionPrompt([], maxTasks);
  }
  return buildAgentExecutionPrompt(queue.tasks, maxTasks);
}
