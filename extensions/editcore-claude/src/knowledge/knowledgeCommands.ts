import * as vscode from "vscode";
import * as path from "path";
import { ApiKeyService } from "../apiKeyService";
import { runKnowledgeIndexing, loadIndexMeta } from "./knowledgeIndexer";
import {
  writeProjectKnowledgeMap,
  formatProjectKnowledgeMarkdown,
  loadProjectKnowledgeMap,
} from "./projectKnowledgeEngine";
import { retrieveKnowledgeContext, isKnowledgeRagEnabled } from "./ragPipeline";
import { runSemanticAnalysis, formatSemanticFindingsMarkdown } from "./semanticAnalyzer";
import { writeKnowledgeDocumentation } from "./docGenerator";
import { writeNextPromptFiles } from "./promptCompletion";
import { refreshArchitectureMemory } from "../memory/architectureMemory";
import { purgeProjectKnowledge, listMemoryAudit } from "../memory/memorySecurity";
import { syncChangeMemoryFromGit } from "../memory/changeMemory";
import { registerActiveProject } from "../memory/multiProjectMemory";
import { KnowledgeCenterViewProvider } from "./knowledgeViewProvider";

export function registerKnowledgeCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  const provider = new KnowledgeCenterViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("editcore.knowledgeView", provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.knowledge.reindex", async () => {
      try {
        const meta = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: indexando conocimiento...",
            cancellable: false,
          },
          async () => {
            await registerActiveProject();
            await refreshArchitectureMemory(context.extension.extensionPath);
            await syncChangeMemoryFromGit();
            return runKnowledgeIndexing();
          }
        );
        await provider.refresh();
        vscode.window.showInformationMessage(
          "Knowledge indexado: " + meta.codeChunks + " chunks, " + meta.memoryRecords + " memoria."
        );
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          "Knowledge: " + (err instanceof Error ? err.message : String(err))
        );
      }
    }),

    vscode.commands.registerCommand("editcore.knowledge.buildMap", async () => {
      const path = await writeProjectKnowledgeMap();
      const map = await loadProjectKnowledgeMap();
      const doc = await vscode.workspace.openTextDocument({
        content: map ? formatProjectKnowledgeMarkdown(map) : "Sin mapa",
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage("Mapa guardado: " + path);
    }),

    vscode.commands.registerCommand("editcore.knowledge.search", async (queryArg?: string) => {
      const query =
        queryArg ??
        (await vscode.window.showInputBox({
          title: "Buscar conocimiento",
          prompt: "Consulta semántica / memoria",
        }));
      if (!query?.trim()) return;

      const result = await retrieveKnowledgeContext(context, query);
      const doc = await vscode.workspace.openTextDocument({
        content:
          "# Resultados: " +
          query +
          "\n\n**Fuentes:** " +
          result.sources.join(", ") +
          "\n**Tokens ~** " +
          result.tokenEstimate +
          "\n\n" +
          result.contextBlock,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    }),

    vscode.commands.registerCommand("editcore.knowledge.semanticAnalysis", async () => {
      const findings = await runSemanticAnalysis();
      const md = formatSemanticFindingsMarkdown(findings);
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.knowledge.openCenter", async () => {
      await vscode.commands.executeCommand("editcore.knowledgeView.focus");
    }),

    vscode.commands.registerCommand("editcore.knowledge.purge", async () => {
      const ok = await vscode.window.showWarningMessage(
        "¿Purgar conocimiento local del proyecto (.editcore/knowledge)?",
        { modal: true },
        "Purgar",
        "Cancelar"
      );
      if (ok !== "Purgar") return;
      const n = await purgeProjectKnowledge();
      await provider.refresh();
      vscode.window.showInformationMessage("Purgados " + n + " archivos de conocimiento.");
    }),

    vscode.commands.registerCommand("editcore.knowledge.auditLog", async () => {
      const audit = await listMemoryAudit(40);
      const md =
        "# Auditoría de memoria\n\n" +
        audit.map((a) => "- " + a.at + " **" + a.action + "** (" + a.scope + "): " + a.detail).join("\n");
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.knowledge.generateDocs", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const paths = await writeKnowledgeDocumentation(root);
      await writeNextPromptFiles(root);
      vscode.window.showInformationMessage("Docs Knowledge + SIGUIENTE_PROMPT_006: " + paths.length + " archivos");
    }),

    vscode.commands.registerCommand("editcore.knowledge.openNextPrompt", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const uri = vscode.Uri.file(path.join(root, ".editcore", "docs", "SIGUIENTE_PROMPT_006.md"));
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      } catch {
        await writeNextPromptFiles(root);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      }
    }),

    vscode.commands.registerCommand("editcore.knowledge.status", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const meta = await loadIndexMeta(root);
      const msg = meta
        ? "Chunks " + meta.codeChunks + " · Memoria " + meta.memoryRecords + " · RAG " + (isKnowledgeRagEnabled() ? "ON" : "OFF")
        : "Sin índice — ejecuta editcore.knowledge.reindex";
      vscode.window.showInformationMessage("EditCore Knowledge: " + msg);
    })
  );
}
