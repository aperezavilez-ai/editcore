import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { runAiOrchestrator } from "./aiOrchestrator";
import { writeAosDocumentation } from "./docGenerator";
import { runEvolutionManagerCycle } from "./evolutionManager";
import { generateWorkPlan, writeWorkPlan } from "./workPlanGenerator";

export function registerAosCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.aos.run", async () => {
      const task = await vscode.window.showInputBox({
        title: "EDITCORE AI Orchestrator",
        prompt: "Describe la tarea a orquestar",
        placeHolder: "ej: Implementar módulo X con tests y documentación",
      });
      if (!task?.trim()) {
        return;
      }
      try {
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EDITCORE AI Orchestrator ejecutando...",
            cancellable: false,
          },
          () => runAiOrchestrator(context, apiKeyService, { task })
        );
        const doc = await vscode.workspace.openTextDocument({
          content: result.markdown,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          "AOS: " + (err instanceof Error ? err.message : String(err))
        );
      }
    }),

    vscode.commands.registerCommand("editcore.aos.generateWorkPlan", async () => {
      const task = await vscode.window.showInputBox({
        title: "Plan de trabajo",
        prompt: "Objetivo de la tarea",
      });
      if (!task?.trim()) {
        return;
      }
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        return;
      }
      const { markdown } = await generateWorkPlan(task);
      const planPath = await writeWorkPlan(root, markdown);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(planPath));
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.aos.evolutionManager", async () => {
      try {
        const result = await runEvolutionManagerCycle(context, apiKeyService);
        const md =
          "# Evolution Manager\n\n" +
          "## Recomendaciones\n" +
          result.recommendations.map((r) => "- " + r).join("\n") +
          "\n\n## Rendimiento\n" +
          result.performanceNotes.map((n) => "- " + n).join("\n");
        const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
        await vscode.window.showTextDocument(doc);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          "Evolution Manager: " + (err instanceof Error ? err.message : String(err))
        );
      }
    }),

    vscode.commands.registerCommand("editcore.aos.generateDocs", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Abre un workspace.");
        return;
      }
      const paths = await writeAosDocumentation(root);
      vscode.window.showInformationMessage(
        "Documentación AOS generada: " + paths.length + " archivos en docs/ y .editcore/docs/"
      );
      const arch = paths.find((p) => p.includes("EDITCORE_AI_ARCHITECTURE"));
      if (arch) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(arch));
        await vscode.window.showTextDocument(doc);
      }
    })
  );
}
