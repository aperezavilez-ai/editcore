/**
 * Ejecutor de fases — una fase a la vez con plan, pruebas, reportes y prompt siguiente.
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { assertAutonomyAction } from "../autonomy/autonomyLevel";
import { runAutonomyCycle } from "../autonomy/autonomyEngine";
import { loadAutonomyQueue } from "../autonomy/taskQueue";
import { runAgentTask, AgentEvent } from "../agent/agentLoop";
import { runOpenAiAgentTask, shouldUseOpenAiForRole } from "../agent/openaiAgentLoop";
import { recordAgentTrace, saveMemoryRecord } from "../memory/memoryManager";
import { logEvent } from "../platform/observability";
import {
  runPostChangeValidation,
  isPostChangeValidationEnabled,
} from "../platform/postChangeValidator";
import {
  collectGitChanges,
  formatChangeReportMarkdown,
  writeChangeReport,
} from "./changeReportGenerator";
import { buildEvolutionPromptMarkdown, writeEvolutionPrompt } from "./evolutionPromptGenerator";
import { createEvolutionBranch, recordActiveBranch } from "./gitSafeFlow";
import {
  buildPlanMarkdown,
  ROADMAP_PHASES,
  writeImplementationPlan,
  type ImplementationPhase,
} from "./planGenerator";
import { buildQaChecklistMarkdown, writeQaChecklist } from "./qaChecklistGenerator";

export interface PhaseExecutionResult {
  phaseId: number;
  phaseName: string;
  markdown: string;
  planPath?: string;
  changeReportPath?: string;
  qaChecklistPath?: string;
  evolutionPromptPath?: string;
  validationPassed?: boolean;
  gitBranch?: string;
}

const PHASE_TASKS: Record<number, string> = {
  1: "Verifica orchestrator, agentPipeline y validateGeneration. No modifiques sin analyze_impact.",
  2: "Verifica memoryManager y tech-memory. Registra decisión si falta algo.",
  3: "Lista tools del agente y confirma git_branch existe. Sin cambios destructivos.",
  4: "Revisa pipeline multiagente (5 roles). Documenta en memoria si hay gap.",
  5: "Ejecuta validación del proyecto y actualiza QA checklist si hay fallos.",
  6: "Ejecuta diagnóstico de autonomía y actualiza cola de tareas.",
  7: "Verifica flujo git: status, branch de evolución si hay cambios pendientes.",
  8: "Genera REPORTE_CAMBIOS con estado git actual.",
  9: "Genera SIGUIENTE_PROMPT con tareas pendientes reales.",
  10: "Confirma routing: Architect Claude, Coder OpenAI si hay key. Reporta estado.",
};

export async function generateImplementationPlan(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<{ markdown: string; planPath?: string }> {
  const allowed = await assertAutonomyAction("plan", "Generar PLAN_IMPLEMENTACION_EDITCORE.md");
  if (!allowed) {
    throw new Error("Nivel de autonomía insuficiente para generar plan.");
  }

  const autonomy = await runAutonomyCycle(context, apiKeyService, {
    saveSystemMap: false,
    recordMemory: false,
  });

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error("Abre un workspace.");
  }

  const markdown = buildPlanMarkdown(autonomy.snapshot, autonomy.health, autonomy.tasks);
  const { editcorePath } = await writeImplementationPlan(root, markdown);

  await saveMemoryRecord(context, {
    type: "decision",
    title: "Plan de implementación generado",
    content: "PLAN_IMPLEMENTACION_EDITCORE.md actualizado con " + autonomy.tasks.length + " tareas.",
    scope: "tech",
  });

  return { markdown, planPath: editcorePath };
}

export async function runEvolutionPhase(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  phaseId: number
): Promise<PhaseExecutionResult> {
  const phase = ROADMAP_PHASES.find((p) => p.id === phaseId);
  if (!phase) {
    throw new Error("Fase inválida: " + phaseId + ". Usa 1–10.");
  }

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error("Abre un workspace.");
  }

  const allowed = await assertAutonomyAction(
    phaseId >= 7 ? "execute_tasks" : phaseId >= 3 ? "write_approved" : "plan",
    "Ejecutar fase " + phaseId + ": " + phase.name
  );
  if (!allowed) {
    throw new Error("Nivel de autonomía insuficiente para fase " + phaseId);
  }

  let gitBranch: string | undefined;
  if (phaseId >= 3) {
    const branchResult = await createEvolutionBranch(root);
    gitBranch = branchResult.branchName;
    if (branchResult.created) {
      await recordActiveBranch(root, gitBranch);
    }
  }

  const { markdown: planMd, planPath } = await generateImplementationPlan(context, apiKeyService);

  const phaseTask = [
    "FASE " + phaseId + ": " + phase.name,
    "",
    PHASE_TASKS[phaseId] ?? "Ejecuta verificación de la fase.",
    "",
    "Archivos clave: " + phase.files.join(", "),
    "Resultado esperado: " + phase.expectedResult,
    "",
    "Reglas: una fase, cambios mínimos, pruebas, documentar en memoria.",
  ].join("\n");

  const apiKey = await apiKeyService.getApiKey();
  let agentSummary = "";

  if (apiKey?.trim() && phaseId >= 3) {
    const openAiKey = await apiKeyService.getOpenAiKey();
    const onEv = (ev: AgentEvent) => {
      if (ev.type === "assistant_text") {
        agentSummary += ev.text;
      }
    };
    if (shouldUseOpenAiForRole("fullstack") && openAiKey?.trim()) {
      await runOpenAiAgentTask(
        openAiKey,
        phaseTask,
        onEv,
        undefined,
        undefined,
        undefined,
        "fullstack",
        apiKeyService
      );
    } else if (apiKey?.trim()) {
      await runAgentTask(
        apiKey,
        phaseTask,
        onEv,
        undefined,
        undefined,
        undefined,
        "architect",
        apiKeyService
      );
    }
    await recordAgentTrace("PhaseExecutor", "fase-" + phaseId, agentSummary.slice(0, 2000), true);
  }

  let validation = null;
  if (isPostChangeValidationEnabled()) {
    validation = await runPostChangeValidation();
  }

  const git = await collectGitChanges(root);
  const changeMarkdown = formatChangeReportMarkdown(git, {
    agents: ["Phase-" + phaseId],
    tasksCompleted: [phase.name],
    validationPassed: validation?.allPassed,
  });
  const { editcorePath: changeReportPath } = await writeChangeReport(root, changeMarkdown);

  const qaMarkdown = buildQaChecklistMarkdown({
    gitClean: git.unstaged.length === 0,
    validation,
  });
  const qaChecklistPath = await writeQaChecklist(root, qaMarkdown);

  const autonomy = await runAutonomyCycle(context, apiKeyService, { saveSystemMap: true });
  const queue = await loadAutonomyQueue();
  const pendingTasks = queue?.tasks.filter((t) => t.status === "pending") ?? [];

  const phasesDone: ImplementationPhase[] = ROADMAP_PHASES.map((p) => ({
    ...p,
    status: p.id <= phaseId ? "done" : p.status,
  }));

  const evolutionMarkdown = buildEvolutionPromptMarkdown({
    snapshot: autonomy.snapshot,
    health: autonomy.health,
    pendingTasks,
    completedPhases: phasesDone.filter((p) => p.status === "done").map((p) => "FASE " + p.id + ": " + p.name),
    recentChanges: "Fase " + phaseId + " ejecutada. " + (git.diffStat || ""),
    limitations: [],
  });
  const { editcorePath: evolutionPromptPath } = await writeEvolutionPrompt(root, evolutionMarkdown);

  await saveMemoryRecord(context, {
    type: "code_change",
    title: "Fase " + phaseId + " completada",
    content: phase.name + ". Validación: " + (validation?.allPassed ? "OK" : "pendiente"),
    scope: "tech",
    metadata: { phaseId, gitBranch },
  });

  await logEvent(context, "info", "evolution", "phase_completed", { phaseId, gitBranch });

  const resultMd = [
    "# Fase " + phaseId + " completada: " + phase.name,
    "",
    "**Rama git:** " + (gitBranch ?? "N/A"),
    "**Validación:** " + (validation?.allPassed ? "✅" : validation ? "❌" : "omitida"),
    "",
    "## Plan",
    "Actualizado: `" + (planPath ?? "") + "`",
    "",
    "## Agente",
    agentSummary.slice(0, 3000) || "_Verificación sin agente (nivel < 3 o sin API key)._",
    "",
    "## Artefactos",
    "- REPORTE: `" + changeReportPath + "`",
    "- QA: `" + qaChecklistPath + "`",
    "- SIGUIENTE_PROMPT: `" + evolutionPromptPath + "`",
  ].join("\n");

  return {
    phaseId,
    phaseName: phase.name,
    markdown: resultMd,
    planPath,
    changeReportPath,
    qaChecklistPath,
    evolutionPromptPath,
    validationPassed: validation?.allPassed,
    gitBranch,
  };
}
