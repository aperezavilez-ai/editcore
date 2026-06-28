/**
 * Interfaz de trabajo — Fase 11 (Prompt 4).
 */
import * as vscode from "vscode";
import { getDiffSummary } from "./gitManager";
import { formatExecutionLogMarkdown, readExecutionLog } from "./executionLog";
import { getRecentTasks, updateTaskStatus, type StoredAutonomousTask } from "./taskStore";
import type { TaskEngineResult } from "./types";
import { confirmCriticalAction } from "./autonomousSecurity";
import { recordInteractionPreference } from "../memory/interactionLearning";

async function showGitDiff(root: string): Promise<void> {
  const diff = await getDiffSummary(root);
  const doc = await vscode.workspace.openTextDocument({
    content: "# Cambios actuales (git diff)\n\n```\n" + diff + "\n```",
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
}

async function explainTaskChanges(root: string, task: StoredAutonomousTask): Promise<void> {
  const diff = await getDiffSummary(root);
  const lines = [
    "# Explicación de cambios — " + task.id,
    "",
    "**Objetivo:** " + task.objective,
    "",
    "**Estado:** " + task.status + (task.success !== undefined ? " (" + (task.success ? "OK" : "FAIL") + ")" : ""),
    "",
    "## Fases ejecutadas",
    "",
    task.explanation ?? (task.phases?.map((p) => "- " + p.phase + ": " + (p.success ? "OK" : "FAIL")).join("\n") ?? "_Sin fases_"),
    "",
    "## Diff actual",
    "",
    "```",
    diff.slice(0, 6000),
    "```",
  ];
  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc);
}

async function acceptTaskChanges(root: string, task: StoredAutonomousTask): Promise<void> {
  const confirmed = await confirmCriticalAction("Aceptar cambios de la tarea " + task.id);
  if (!confirmed) {
    return;
  }
  await updateTaskStatus(root, task.id, "completed");
  await recordInteractionPreference("accepted", "Tarea aceptada: " + task.objective.slice(0, 120), ["ade"]);
  vscode.window.showInformationMessage("Tarea " + task.id + " marcada como aceptada.");
}

async function rejectTaskChanges(root: string, task: StoredAutonomousTask): Promise<void> {
  const confirmed = await confirmCriticalAction(
    "Rechazar cambios: se ejecutará git checkout -- . (puede perder cambios no commiteados)"
  );
  if (!confirmed) {
    return;
  }
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  try {
    await execAsync("git checkout -- .", { cwd: root });
    await updateTaskStatus(root, task.id, "cancelled");
    await recordInteractionPreference("rejected", "Cambios revertidos: " + task.objective.slice(0, 120), ["ade"]);
    vscode.window.showInformationMessage("Cambios revertidos. Tarea cancelada.");
  } catch (err: unknown) {
    vscode.window.showErrorMessage(
      "No se pudo revertir: " + (err instanceof Error ? err.message : String(err))
    );
  }
}

export async function openTaskWorkbenchInteractive(root: string): Promise<void> {
  const tasks = await getRecentTasks(root, 25);
  if (tasks.length === 0) {
    const entries = await readExecutionLog(root, 30);
    const md = formatExecutionLogMarkdown(entries);
    const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
    await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    vscode.window.showInformationMessage(
      "Sin tareas en cola. Usa editcore.autonomous.run para crear una."
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(
    tasks.map((t) => ({
      label: (t.success ? "$(check) " : t.status === "failed" ? "$(error) " : "$(circle-outline) ") + t.objective.slice(0, 60),
      description: t.id + " · " + t.status + " · " + t.workMode,
      task: t,
    })),
    { placeHolder: "EditCore Workbench — selecciona una tarea" }
  );
  if (!pick) {
    return;
  }

  const action = await vscode.window.showQuickPick(
    [
      { label: "Ver resultado / fases", id: "explain" },
      { label: "Ver diff git actual", id: "diff" },
      { label: "Aceptar cambios", id: "accept" },
      { label: "Rechazar y revertir", id: "reject" },
      { label: "Abrir reporte de completitud", id: "report" },
      { label: "Abrir plan de mejoras", id: "improve" },
    ],
    { placeHolder: "Acción para: " + pick.task.objective.slice(0, 40) }
  );
  if (!action) {
    return;
  }

  switch (action.id) {
    case "explain":
      await explainTaskChanges(root, pick.task);
      break;
    case "diff":
      await showGitDiff(root);
      break;
    case "accept":
      await acceptTaskChanges(root, pick.task);
      break;
    case "reject":
      await rejectTaskChanges(root, pick.task);
      break;
    case "report":
      if (pick.task.artifacts?.completionReport) {
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(pick.task.artifacts.completionReport)
        );
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showWarningMessage("Sin reporte para esta tarea.");
      }
      break;
    case "improve":
      if (pick.task.artifacts?.improvementPlan) {
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(pick.task.artifacts.improvementPlan)
        );
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showWarningMessage("Sin plan de mejoras para esta tarea.");
      }
      break;
  }
}

export async function showTaskWorkbench(root: string): Promise<void> {
  await openTaskWorkbenchInteractive(root);
}

export async function showTaskResult(result: TaskEngineResult): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: result.markdown,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });

  const actions = ["Ver diff git", "Abrir Workbench"];
  if (result.completionReportPath) actions.push("Ver reporte");
  if (result.improvementPlanPath) actions.push("Ver mejoras");

  const pick = await vscode.window.showInformationMessage(
    "Tarea autónoma: " + (result.success ? "OK" : "revisar"),
    ...actions
  );

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return;
  }

  if (pick === "Ver diff git") {
    await showGitDiff(root);
  } else if (pick === "Abrir Workbench") {
    await openTaskWorkbenchInteractive(root);
  } else if (pick === "Ver reporte" && result.completionReportPath) {
    const fileDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.completionReportPath));
    await vscode.window.showTextDocument(fileDoc);
  } else if (pick === "Ver mejoras" && result.improvementPlanPath) {
    const fileDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.improvementPlanPath));
    await vscode.window.showTextDocument(fileDoc);
  }
}

export function formatTaskStatusBar(result: TaskEngineResult): string {
  return (
    "ADE: " +
    (result.success ? "OK" : "FAIL") +
    " · " +
    result.phases.length +
    " fases · " +
    result.workMode
  );
}

export { showGitDiff };
