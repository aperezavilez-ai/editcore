import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { runAgentTask, AgentEvent } from "../agent/agentLoop";
import { assertAutonomyAction } from "./autonomyLevel";
import { requestPermission } from "../intelligence/permissionGate";
import { getAutonomyExecutionPrompt, runAutonomyCycle } from "./autonomyEngine";
import { loadAutonomyQueue, markTaskStatus } from "./taskQueue";

async function openMarkdownReport(markdown: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
}

export function registerAutonomyCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.autonomy.diagnose", async () => {
      try {
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: autonomía real (diagnóstico + tareas)...",
            cancellable: false,
          },
          () => runAutonomyCycle(context, apiKeyService)
        );
        await openMarkdownReport(result.markdown);
        if (result.cursorPromptPath) {
          const open = await vscode.window.showInformationMessage(
            `Cola guardada. ${result.tasks.filter((t) => t.status === "pending").length} tareas pendientes.`,
            "Abrir prompts Cursor",
            "Abrir cola JSON"
          );
          if (open === "Abrir prompts Cursor") {
            const doc = await vscode.workspace.openTextDocument(
              vscode.Uri.file(result.cursorPromptPath)
            );
            await vscode.window.showTextDocument(doc);
          } else if (open === "Abrir cola JSON" && result.queuePath) {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.queuePath));
            await vscode.window.showTextDocument(doc);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`EditCore Autonomía: ${message}`);
      }
    }),

    vscode.commands.registerCommand("editcore.autonomy.openQueue", async () => {
      const queue = await loadAutonomyQueue();
      if (!queue) {
        vscode.window.showWarningMessage(
          "No hay cola de autonomía. Ejecuta primero editcore.autonomy.diagnose."
        );
        return;
      }
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) {
        return;
      }
      const uri = vscode.Uri.joinPath(folder.uri, ".editcore", "autonomy", "queue.json");
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.autonomy.execute", async () => {
      const allowed = await assertAutonomyAction(
        "execute_tasks",
        "Ejecutar tarea de automejora con el agente"
      );
      if (!allowed) {
        return;
      }

      const codeAllowed = await requestPermission(
        "write_code",
        "Ejecutar la siguiente tarea de automejora con herramientas reales"
      );
      if (!codeAllowed) {
        return;
      }

      const queue = await loadAutonomyQueue();
      if (!queue) {
        const runFirst = await vscode.window.showWarningMessage(
          "No hay cola. ¿Generar diagnóstico y tareas ahora?",
          "Sí",
          "No"
        );
        if (runFirst === "Sí") {
          await vscode.commands.executeCommand("editcore.autonomy.diagnose");
        }
        return;
      }

      const next = queue.tasks.find((t) => t.status === "pending");
      if (!next) {
        vscode.window.showInformationMessage("No hay tareas pendientes en la cola.");
        return;
      }

      const useAde = vscode.workspace
        .getConfiguration("editcore")
        .get<boolean>("autonomous.useForAutonomyQueue", true);

      if (useAde) {
        await markTaskStatus(next.id, "in_progress");
        try {
          const { runAutonomousTaskEngine } = await import("../autonomous/taskEngine");
          const { showTaskResult } = await import("../autonomous/taskWorkbench");
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "EditCore: ejecutando tarea con ADE...",
              cancellable: false,
            },
            () =>
              runAutonomousTaskEngine(context, apiKeyService, {
                objective: next.title + "\n\n" + next.agentPrompt,
              })
          );
          await showTaskResult(result);
          await markTaskStatus(next.id, result.success ? "done" : "pending");
        } catch (err: unknown) {
          await markTaskStatus(next.id, "pending");
          vscode.window.showErrorMessage(
            "ADE: " + (err instanceof Error ? err.message : String(err))
          );
        }
        return;
      }

      const apiKey = await apiKeyService.getApiKey();
      if (!apiKey?.trim()) {
        vscode.window.showErrorMessage("Configura API Key de Claude para ejecutar tareas con el agente.");
        return;
      }

      await markTaskStatus(next.id, "in_progress");

      const output = vscode.window.createOutputChannel("EditCore Autonomía");
      output.show(true);
      output.appendLine(`Ejecutando: ${next.title} (${next.id})`);
      output.appendLine("---");

      let assistantText = "";
      await runAgentTask(
        apiKey,
        next.agentPrompt,
        (event: AgentEvent) => {
          if (event.type === "assistant_text") {
            assistantText += event.text;
            output.appendLine(event.text);
          } else if (event.type === "tool_call_start") {
            output.appendLine(`[tool] ${event.name}`);
          } else if (event.type === "tool_call_result") {
            output.appendLine(
              `[result] ${event.name}: ${event.output.slice(0, 500)}${event.output.length > 500 ? "…" : ""}`
            );
          } else if (event.type === "error") {
            output.appendLine(`[error] ${event.message}`);
          }
        },
        undefined,
        undefined,
        undefined,
        "default",
        apiKeyService
      );

      const done = await vscode.window.showInformationMessage(
        `Tarea «${next.title}» finalizada. ¿Marcar como completada?`,
        "Completada",
        "Pendiente",
        "Omitir"
      );
      if (done === "Completada") {
        await markTaskStatus(next.id, "done");
      } else if (done === "Omitir") {
        await markTaskStatus(next.id, "skipped");
      } else {
        await markTaskStatus(next.id, "pending");
      }

      if (assistantText.trim()) {
        await openMarkdownReport(`# Resultado: ${next.title}\n\n${assistantText}`);
      }
    })
  );
}

export async function buildAutonomyAgentTaskFromQueue(): Promise<string> {
  return getAutonomyExecutionPrompt(
    vscode.workspace.getConfiguration("editcore").get<number>("autonomy.maxTasksPerRun", 3)
  );
}
