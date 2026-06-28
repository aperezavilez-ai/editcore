import * as vscode from "vscode";
import * as path from "path";
import { ApiKeyService } from "../apiKeyService";
import {
  buildAutonomousPlan,
  formatAutonomousPlanMarkdown,
  writeAutonomousPlan,
} from "./autonomousPlanner";
import { writeAutonomousDocumentation } from "./docGenerator";
import { writeNextPromptFiles } from "./promptCompletion";
import { showGitDiff } from "./taskWorkbench";
import { analyzeProject, writeProjectUnderstanding } from "./projectAnalyzer";
import { runAutonomousTaskEngine } from "./taskEngine";
import { showTaskResult, showTaskWorkbench } from "./taskWorkbench";
import { getWorkMode, setWorkMode } from "./workMode";

export function registerAutonomousCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.autonomous.run", async () => {
      const objective = await vscode.window.showInputBox({
        title: "EDITCORE Autonomous Developer Engine",
        prompt: "Describe el objetivo a implementar",
        placeHolder: 'ej: Agrega autenticación con Google',
      });
      if (!objective?.trim()) {
        return;
      }
      try {
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: desarrollador autónomo ejecutando...",
            cancellable: false,
          },
          () => runAutonomousTaskEngine(context, apiKeyService, { objective })
        );
        await showTaskResult(result);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          "Autonomous Engine: " + (err instanceof Error ? err.message : String(err))
        );
      }
    }),

    vscode.commands.registerCommand("editcore.autonomous.analyzeProject", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Abre un workspace.");
        return;
      }
      const understanding = await analyzeProject(root);
      const filePath = await writeProjectUnderstanding(root, understanding);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.autonomous.generatePlan", async () => {
      const objective = await vscode.window.showInputBox({
        title: "Plan autónomo",
        prompt: "Objetivo",
      });
      if (!objective?.trim()) {
        return;
      }
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        return;
      }
      const understanding = await analyzeProject(root);
      const plan = buildAutonomousPlan(objective, understanding);
      const md = formatAutonomousPlanMarkdown(plan);
      const planPath = await writeAutonomousPlan(root, md);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(planPath));
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.autonomous.openWorkbench", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Abre un workspace.");
        return;
      }
      await showTaskWorkbench(root);
    }),

    vscode.commands.registerCommand("editcore.autonomous.setMode", async () => {
      const current = getWorkMode();
      const pick = await vscode.window.showQuickPick(
        [
          {
            label: "Copiloto",
            description: "Sugiere y espera aprobación",
            mode: "copilot" as const,
          },
          {
            label: "Autónomo",
            description: "Planifica, implementa y prueba",
            mode: "autonomous" as const,
          },
        ],
        { placeHolder: "Modo actual: " + current }
      );
      if (!pick) {
        return;
      }
      await setWorkMode(pick.mode);
      vscode.window.showInformationMessage("Modo autónomo: " + pick.label);
    }),

    vscode.commands.registerCommand("editcore.autonomous.generateDocs", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Abre un workspace.");
        return;
      }
      const paths = await writeAutonomousDocumentation(root);
      await writeNextPromptFiles(root);
      vscode.window.showInformationMessage(
        "Documentación autónoma + SIGUIENTE_PROMPT_005 generados (" + paths.length + " archivos)"
      );
      const arch = paths.find((p) => p.includes("EDITCORE_AUTONOMOUS_ENGINE"));
      if (arch) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(arch));
        await vscode.window.showTextDocument(doc);
      }
    }),

    vscode.commands.registerCommand("editcore.autonomous.showDiff", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        return;
      }
      await showGitDiff(root);
    }),

    vscode.commands.registerCommand("editcore.autonomous.openNextPrompt", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        return;
      }
      const uri = vscode.Uri.file(path.join(root, ".editcore", "docs", "SIGUIENTE_PROMPT_005.md"));
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      } catch {
        await writeNextPromptFiles(root);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      }
    })
  );
}
