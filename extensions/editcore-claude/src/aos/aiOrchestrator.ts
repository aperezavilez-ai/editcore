/**
 * EDITCORE AI ORCHESTRATOR — núcleo central (Fase 1, Prompt 3).
 *
 * Flujo: solicitud → análisis → plan → agentes → modelo → ejecución → validación → reporte
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { runAgentTask, AgentEvent } from "../agent/agentLoop";
import { runOpenAiAgentTask } from "../agent/openaiAgentLoop";
import { assertAutonomyAction, getAutonomyLevel } from "../autonomy/autonomyLevel";
import { createEvolutionBranch, recordActiveBranch } from "../evolution/gitSafeFlow";
import {
  collectGitChanges,
  formatChangeReportMarkdown,
  writeChangeReport,
} from "../evolution/changeReportGenerator";
import { buildQaChecklistMarkdown, writeQaChecklist } from "../evolution/qaChecklistGenerator";
import { recordAgentTrace, saveMemoryRecord } from "../memory/memoryManager";
import { logEvent } from "../platform/observability";
import {
  isPostChangeValidationEnabled,
  runPostChangeValidation,
} from "../platform/postChangeValidator";
import { getAgentsForIntent } from "./agentRegistry";
import { detectTaskIntent, resolveModelForAgent } from "./modelRouter";
import type { OrchestratorPhaseResult, OrchestratorRequest, OrchestratorResult } from "./types";
import { buildWorkPlanMarkdown, writeWorkPlan } from "./workPlanGenerator";
import { runEvolutionManagerCycle } from "./evolutionManager";

async function runAgentForRole(
  apiKeyService: ApiKeyService,
  roleId: import("../agents/roles").AgentRoleId,
  task: string,
  onText: (text: string) => void
): Promise<{ output: string; success: boolean }> {
  const route = resolveModelForAgent(roleId, task);
  let output = "";

  const onEvent = (ev: AgentEvent) => {
    if (ev.type === "assistant_text") {
      output += ev.text;
      onText(ev.text);
    }
    if (ev.type === "error") {
      output += "\n[error] " + ev.message;
    }
  };

  try {
    if (route.provider === "openai") {
      const openAiKey = await apiKeyService.getOpenAiKey();
      if (!openAiKey?.trim()) {
        const claudeKey = await apiKeyService.getApiKey();
        if (!claudeKey?.trim()) {
          return { output: "Sin API keys.", success: false };
        }
        await runAgentTask(claudeKey, task, onEvent, undefined, undefined, undefined, roleId, apiKeyService);
      } else {
        await runOpenAiAgentTask(
          openAiKey,
          task,
          onEvent,
          undefined,
          undefined,
          undefined,
          roleId,
          apiKeyService
        );
      }
    } else {
      const claudeKey = await apiKeyService.getApiKey();
      if (!claudeKey?.trim()) {
        return { output: "Sin API key Claude.", success: false };
      }
      await runAgentTask(claudeKey, task, onEvent, undefined, undefined, undefined, roleId, apiKeyService);
    }
    return { output, success: output.length > 0 && !output.includes("[error]") };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: output + "\n" + msg, success: false };
  }
}

export async function runAiOrchestrator(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  request: OrchestratorRequest
): Promise<OrchestratorResult> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error("Abre un workspace para usar el AI Orchestrator.");
  }

  const startedAt = new Date().toISOString();
  const requestId = "aos-" + Date.now();
  const intent = request.intent ?? detectTaskIntent(request.task);
  const phases: OrchestratorPhaseResult[] = [];
  let sharedContext = "Tarea del usuario:\n" + request.task + "\n\nIntent detectado: " + intent;

  const level = getAutonomyLevel();
  if (level < 2) {
    const ok = await assertAutonomyAction("plan", "Ejecutar AI Orchestrator");
    if (!ok) {
      throw new Error("Nivel de autonomía insuficiente (mínimo 2).");
    }
  }

  let workPlanPath: string | undefined;
  if (!request.skipPlan) {
    const planMd = buildWorkPlanMarkdown({
      objective: request.task,
      analysis: "Generado por EDITCORE AI Orchestrator antes de ejecución.",
    });
    workPlanPath = await writeWorkPlan(root, planMd);
    sharedContext += "\n\n## Plan de trabajo\nVer PLAN_DE_TRABAJO.md en .editcore/docs/";
  }

  if (level >= 3 && intent !== "architecture") {
    const branch = await createEvolutionBranch(root);
    if (branch.created) {
      await recordActiveBranch(root, branch.branchName);
      sharedContext += "\n\nRama git: " + branch.branchName;
    }
  }

  const agents = getAgentsForIntent(request.task);
  let allSuccess = true;

  for (const agent of agents) {
    if (request.skipReview && ["reviewer", "security", "qa", "debug"].includes(agent.id)) {
      continue;
    }

    const stepTask = [
      sharedContext,
      "",
      "## Rol: " + agent.label,
      "Modelo: " + agent.preferredProvider + "/" + agent.preferredModel,
      agent.instruction,
    ].join("\n");

    const route = resolveModelForAgent(agent.id, request.task);
    let stepOutput = "";

    const { output, success } = await runAgentForRole(
      apiKeyService,
      agent.id,
      stepTask,
      (text) => {
        stepOutput += text;
      }
    );

    await recordAgentTrace(agent.label, agent.instruction, output.slice(0, 2000), success);
    phases.push({
      agent: agent.label,
      role: agent.id,
      provider: route.provider,
      model: route.model,
      output: output.slice(0, 4000),
      success,
    });

    if (!success) {
      allSuccess = false;
    }
    sharedContext += "\n\n## Salida " + agent.label + "\n" + output.slice(0, 3000);
  }

  let validationPassed: boolean | undefined;
  if (isPostChangeValidationEnabled() && level >= 4) {
    const validation = await runPostChangeValidation();
    validationPassed = validation?.allPassed;
    if (validation) {
      sharedContext += "\n\n## Validación\n" + (validation.allPassed ? "PASS" : "FAIL");
    }
  }

  const git = await collectGitChanges(root);
  const changeMd = formatChangeReportMarkdown(git, {
    agents: phases.map((p) => p.agent),
    validationPassed,
  });
  const { editcorePath: changeReportPath } = await writeChangeReport(root, changeMd);

  const qaMd = buildQaChecklistMarkdown({ validation: null, gitClean: git.unstaged.length === 0 });
  await writeQaChecklist(root, qaMd);

  if (intent === "evolve" || level >= 5) {
    await runEvolutionManagerCycle(context, apiKeyService).catch(() => undefined);
  }

  await saveMemoryRecord(context, {
    type: "agent_action",
    title: "AI Orchestrator — " + intent,
    content: phases.map((p) => p.agent + ": " + (p.success ? "OK" : "FAIL")).join(", "),
    scope: "tech",
    metadata: { requestId, workPlanPath },
  });

  await logEvent(context, "info", "aos", "orchestrator_completed", {
    requestId,
    intent,
    phases: phases.length,
    success: allSuccess,
  });

  const completedAt = new Date().toISOString();
  const markdown = [
    "# EDITCORE AI Orchestrator — resultado",
    "",
    "**ID:** " + requestId,
    "**Intent:** " + intent,
    "**Nivel autonomía:** " + level,
    "",
    "## Fases ejecutadas",
    "",
    ...phases.map(
      (p, i) =>
        "### " +
        (i + 1) +
        ". " +
        p.agent +
        " (" +
        p.provider +
        "/" +
        p.model +
        ") " +
        (p.success ? "✅" : "❌")
    ),
    "",
    "## Artefactos",
    "- PLAN: `" + (workPlanPath ?? "N/A") + "`",
    "- REPORTE: `" + changeReportPath + "`",
    "",
    phases.map((p) => "#### " + p.agent + "\n" + p.output.slice(0, 1500)).join("\n\n"),
  ].join("\n");

  return {
    requestId,
    startedAt,
    completedAt,
    intent,
    phases,
    workPlanPath,
    changeReportPath,
    validationPassed,
    markdown,
  };
}
