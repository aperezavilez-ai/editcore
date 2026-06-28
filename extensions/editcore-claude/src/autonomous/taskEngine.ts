/**
 * EDITCORE TASK ENGINE — Fase 1 (Prompt 4).
 *
 * Flujo: objetivo → análisis → plan → git → implementar → self-debug → QA → reportes
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { assertAutonomyAction, getAutonomyLevel } from "../autonomy/autonomyLevel";
import { runAiOrchestrator } from "../aos/aiOrchestrator";
import { logEvent } from "../platform/observability";
import { saveMemoryRecord } from "../memory/memoryManager";
import { runAutonomousCoder } from "./autonomousCoder";
import {
  buildAutonomousPlan,
  formatAutonomousPlanMarkdown,
  writeAutonomousPlan,
} from "./autonomousPlanner";
import { appendExecutionLog } from "./executionLog";
import {
  collectModifiedFiles,
  createAutonomousCommit,
  ensureTaskGitBranch,
} from "./gitManager";
import { buildImprovementPlan, writeImprovementPlan } from "./improvementGenerator";
import { analyzeProject, writeProjectUnderstanding } from "./projectAnalyzer";
import { runQualityGate } from "./qualityGate";
import { runSelfDebugLoop } from "./selfDebugLoop";
import { createPendingTask, markTaskInProgress, saveTaskResult } from "./taskStore";
import { recordChangeMemory } from "../memory/changeMemory";
import type { AutonomousTaskRequest, PhaseResult, TaskEngineResult } from "./types";
import {
  getWorkMode,
  isAutonomousEngineEnabled,
  requiresImplementationApproval,
} from "./workMode";

export async function runAutonomousTaskEngine(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  request: AutonomousTaskRequest
): Promise<TaskEngineResult> {
  if (!isAutonomousEngineEnabled()) {
    throw new Error("Motor autónomo desactivado. Activa editcore.autonomous.enabled.");
  }

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error("Abre un workspace para usar el Autonomous Developer Engine.");
  }

  const workMode = getWorkMode();
  const level = getAutonomyLevel();

  const pending = await createPendingTask(root, request.objective, workMode);
  const taskId = pending.id;
  const startedAt = pending.createdAt;
  await markTaskInProgress(root, taskId);

  const phases: PhaseResult[] = [];

  const okAnalyze = await assertAutonomyAction("analyze", "Analizar proyecto");
  if (!okAnalyze) {
    throw new Error("Nivel insuficiente para análisis.");
  }

  // Fase 2: PROJECT_UNDERSTANDING
  const understanding = await analyzeProject(root);
  const projectUnderstandingPath = await writeProjectUnderstanding(root, understanding);
  await appendExecutionLog(root, {
    taskId,
    phase: "analyze",
    action: "project_understanding",
    detail: understanding.summary,
    success: true,
  });
  phases.push({
    phase: "analyze",
    success: true,
    output: understanding.summary,
    artifactPath: projectUnderstandingPath,
  });

  // Fase 3: Plan
  const planOk = await assertAutonomyAction("plan", "Crear plan autónomo");
  if (!planOk) {
    throw new Error("Nivel insuficiente para planificación.");
  }
  const plan = buildAutonomousPlan(request.objective, understanding);
  const planMd = formatAutonomousPlanMarkdown(plan);
  const planPath = await writeAutonomousPlan(root, planMd);
  phases.push({
    phase: "plan",
    success: true,
    output: plan.steps.join("\n"),
    artifactPath: planPath,
  });

  let contextBlock = [
    "## PROJECT_UNDERSTANDING",
    understanding.summary,
    "",
    "## PLAN",
    planMd.slice(0, 4000),
    "",
    "## Objetivo",
    request.objective,
  ].join("\n");

  let gitBranch: string | undefined;
  let gitCommit: string | undefined;

  // Copiloto: detener tras plan si no hay aprobación
  if (request.skipImplementation) {
    const result = buildResult({
      taskId,
      startedAt,
      request,
      workMode,
      phases,
      projectUnderstandingPath,
      planPath,
      success: true,
    });
    await saveTaskResult(root, result);
    return result;
  }

  const implementApproved = await requiresImplementationApproval(
    "¿Implementar el plan para: " + request.objective.slice(0, 80) + "?"
  );

  if (!implementApproved) {
    phases.push({
      phase: "implement",
      success: true,
      output: "Modo copiloto: solo plan generado, sin implementación.",
    });
    const planOnlyResult = buildResult({
      taskId,
      startedAt,
      request,
      workMode,
      phases,
      projectUnderstandingPath,
      planPath,
      success: true,
    });
    await saveTaskResult(root, planOnlyResult);
    return planOnlyResult;
  }

  // Fase 7: Git backup
  if (!request.skipGit && level >= 3) {
    const git = await ensureTaskGitBranch(root, taskId);
    gitBranch = git.branchName;
    contextBlock += "\n\nRama git: " + git.branchName;
    phases.push({
      phase: "git_backup",
      success: Boolean(git.branchName),
      output: git.output,
    });
  }

  // Fase 4+1: Implementación (AOS pipeline o coder directo)
  const useAos = vscode.workspace.getConfiguration("editcore").get<boolean>("autonomous.useAosPipeline", true);

  if (useAos && level >= 3) {
    const aosResult = await runAiOrchestrator(context, apiKeyService, {
      task: request.objective,
      skipPlan: true,
    });
    phases.push({
      phase: "implement",
      success: aosResult.phases.every((p) => p.success),
      output: aosResult.markdown.slice(0, 3000),
      artifactPath: aosResult.changeReportPath,
    });
  } else {
    const { output, success } = await runAutonomousCoder(
      apiKeyService,
      request.objective,
      contextBlock
    );
    phases.push({
      phase: "implement",
      success,
      output: output.slice(0, 3000),
    });
  }

  // Fase 6: Self debug loop
  let debugResult;
  if (level >= 4) {
    debugResult = await runSelfDebugLoop(root, taskId, apiKeyService, request.objective, contextBlock);
    phases.push({
      phase: "self_debug",
      success: debugResult.fixed,
      output: debugResult.log.join("\n"),
    });
  }

  // Fase 9: Quality gate
  const modifiedFiles = await collectModifiedFiles(root);
  const quality = await runQualityGate(
    root,
    apiKeyService,
    request.objective,
    plan,
    gitBranch,
    gitCommit
  );
  phases.push({
    phase: "quality_gate",
    success: quality.passed,
    output: quality.codeReview.slice(0, 500),
    artifactPath: quality.reportPath,
  });

  // Git commit opcional
  if (
    level >= 4 &&
    modifiedFiles.length > 0 &&
    vscode.workspace.getConfiguration("editcore").get<boolean>("autonomous.autoCommit", false)
  ) {
    const commit = await createAutonomousCommit(root, request.objective, modifiedFiles);
    if (commit.committed) {
      gitCommit = commit.message;
    }
    phases.push({
      phase: "git_backup",
      success: commit.committed,
      output: commit.output,
    });
  }

  // Fase 10: Improvement plan
  const improvementMd = buildImprovementPlan({
    objective: request.objective,
    understanding,
    plan,
    quality,
    modifiedFiles,
  });
  const improvementPlanPath = await writeImprovementPlan(root, improvementMd);
  phases.push({
    phase: "improve",
    success: true,
    output: "NEXT_IMPROVEMENT_PLAN generado",
    artifactPath: improvementPlanPath,
  });

  await saveMemoryRecord(context, {
    type: "agent_action",
    title: "Autonomous Task — " + request.objective.slice(0, 60),
    content: phases.map((p) => p.phase + ": " + (p.success ? "OK" : "FAIL")).join(", "),
    scope: "tech",
    metadata: { taskId, workMode, level },
  });

  await logEvent(context, "info", "autonomous", "task_completed", {
    taskId,
    success: quality.passed,
    phases: phases.length,
  });

  const finalResult = buildResult({
    taskId,
    startedAt,
    request,
    workMode,
    phases,
    projectUnderstandingPath,
    planPath,
    completionReportPath: quality.reportPath,
    improvementPlanPath,
    validation: debugResult?.validation ?? quality.validation,
    gitBranch,
    gitCommit,
    success: quality.passed,
  });

  await saveTaskResult(root, finalResult);

  try {
    await recordChangeMemory({
      what: request.objective,
      why: "Autonomous Developer Engine task " + taskId,
      files: modifiedFiles,
      result: quality.passed ? "success" : "partial",
      problems: quality.passed ? undefined : ["Quality gate no pasó"],
    });
  } catch {
    // optional
  }

  return finalResult;
}

function buildResult(input: {
  taskId: string;
  startedAt: string;
  request: AutonomousTaskRequest;
  workMode: string;
  phases: PhaseResult[];
  projectUnderstandingPath?: string;
  planPath?: string;
  completionReportPath?: string;
  improvementPlanPath?: string;
  validation?: import("../platform/postChangeValidator").ValidationReport;
  gitBranch?: string;
  gitCommit?: string;
  success: boolean;
}): TaskEngineResult {
  const completedAt = new Date().toISOString();
  const markdown = [
    "# EDITCORE Autonomous Developer Engine — resultado",
    "",
    "**ID:** " + input.taskId,
    "**Modo:** " + input.workMode,
    "**Estado:** " + (input.success ? "COMPLETADO" : "REQUIERE ATENCIÓN"),
    "",
    "## Objetivo",
    input.request.objective,
    "",
    "## Fases",
    "",
    ...input.phases.map(
      (p, i) =>
        (i + 1) +
        ". **" +
        p.phase +
        "** " +
        (p.success ? "OK" : "FAIL") +
        (p.artifactPath ? " → `" + p.artifactPath + "`" : "")
    ),
    "",
    "## Artefactos",
    "- PROJECT_UNDERSTANDING: `" + (input.projectUnderstandingPath ?? "N/A") + "`",
    "- PLAN: `" + (input.planPath ?? "N/A") + "`",
    "- TASK_COMPLETION_REPORT: `" + (input.completionReportPath ?? "N/A") + "`",
    "- NEXT_IMPROVEMENT_PLAN: `" + (input.improvementPlanPath ?? "N/A") + "`",
  ].join("\n");

  return {
    taskId: input.taskId,
    startedAt: input.startedAt,
    completedAt,
    objective: input.request.objective,
    workMode: input.workMode as import("./types").WorkMode,
    phases: input.phases,
    projectUnderstandingPath: input.projectUnderstandingPath,
    planPath: input.planPath,
    completionReportPath: input.completionReportPath,
    improvementPlanPath: input.improvementPlanPath,
    validation: input.validation,
    gitBranch: input.gitBranch,
    gitCommit: input.gitCommit,
    markdown,
    success: input.success,
  };
}
