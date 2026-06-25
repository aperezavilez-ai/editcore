import * as vscode from "vscode";
import { registerProjectRegistry } from "./projectRegistry";
import {
  listGlobalMemory,
  syncWorkspaceMemoryToGlobal,
  addGlobalMemory,
  searchGlobalMemory,
} from "./globalMemory";
import { analyzeCrossProjects, saveIntelligenceReport } from "./projectIntelligence";
import { logEvent, readRecentEvents, formatObservabilityReport } from "../platform/observability";

export function registerGlobalCommands(context: vscode.ExtensionContext): void {
  registerProjectRegistry(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.globalMemory", async () => {
      const entries = await listGlobalMemory(context);
      const pick = await vscode.window.showQuickPick(
        entries.slice(0, 20).map((e) => ({
          label: e.title,
          description: `${e.type} — ${e.projectName ?? "global"}`,
          entry: e,
        })),
        { placeHolder: "Memoria global" }
      );
      if (!pick) return;
      const doc = await vscode.workspace.openTextDocument({
        content: `# ${pick.entry.title}\n\n${pick.entry.content}`,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.syncGlobalMemory", async () => {
      const n = await syncWorkspaceMemoryToGlobal(context);
      vscode.window.showInformationMessage(
        n > 0 ? "Memoria del workspace sincronizada a global." : "Nada nuevo que sincronizar."
      );
    }),

    vscode.commands.registerCommand("editcore.addGlobalMemory", async () => {
      const title = await vscode.window.showInputBox({ prompt: "Título de la memoria" });
      if (!title) return;
      const content = await vscode.window.showInputBox({ prompt: "Contenido" });
      if (!content) return;
      const folder = vscode.workspace.workspaceFolders?.[0];
      await addGlobalMemory(context, {
        type: "pattern",
        title,
        content,
        tags: [],
        projectPath: folder?.uri.fsPath,
        projectName: folder?.name,
      });
      vscode.window.showInformationMessage("Memoria global guardada.");
    }),

    vscode.commands.registerCommand("editcore.projectIntelligence", async () => {
      const findings = await analyzeCrossProjects(context);
      const filePath = await saveIntelligenceReport(context, findings);
      if (filePath) {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      }
      void logEvent(context, "info", "intelligence", `${findings.length} hallazgos`);
    }),

    vscode.commands.registerCommand("editcore.observability", async () => {
      const events = await readRecentEvents(context, 40);
      const doc = await vscode.workspace.openTextDocument({
        content: formatObservabilityReport(events),
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.searchGlobalMemory", async () => {
      const q = await vscode.window.showInputBox({ prompt: "Buscar en memoria global" });
      if (!q) return;
      const hits = await searchGlobalMemory(context, q);
      const msg = hits.length
        ? hits.map((h) => `${h.title}: ${h.content.slice(0, 80)}`).join("\n")
        : "Sin resultados";
      await vscode.window.showInformationMessage(msg, { modal: true });
    })
  );
}

export async function getGlobalMemoryBlock(
  context: vscode.ExtensionContext,
  query: string
): Promise<string> {
  const { getGlobalMemoryContext } = await import("./globalMemory");
  return getGlobalMemoryContext(context, query);
}
