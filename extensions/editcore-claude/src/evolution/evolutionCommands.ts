import * as vscode from "vscode";

import { ApiKeyService } from "../apiKeyService";

import { getAutonomyLevel, AUTONOMY_LEVELS } from "../autonomy/autonomyLevel";

import { runEvolutionCycle } from "./evolutionCycle";

import { generateImplementationPlan, runEvolutionPhase } from "./phaseExecutor";



async function openMarkdownBeside(markdown: string): Promise<void> {

  const doc = await vscode.workspace.openTextDocument({ content: markdown, language: "markdown" });

  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });

}



async function openFilePath(filePath: string): Promise<void> {

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));

  await vscode.window.showTextDocument(doc);

}



export function registerEvolutionCommands(

  context: vscode.ExtensionContext,

  apiKeyService: ApiKeyService

): void {

  context.subscriptions.push(

    vscode.commands.registerCommand("editcore.evolution.generatePlan", async () => {

      try {

        const result = await vscode.window.withProgress(

          {

            location: vscode.ProgressLocation.Notification,

            title: "EditCore: generando PLAN_IMPLEMENTACION...",

            cancellable: false,

          },

          () => generateImplementationPlan(context, apiKeyService)

        );

        await openMarkdownBeside(result.markdown);

        if (result.planPath) {

          const open = await vscode.window.showInformationMessage(

            "Plan guardado en repo.",

            "Abrir archivo"

          );

          if (open === "Abrir archivo") {

            await openFilePath(result.planPath);

          }

        }

      } catch (err: unknown) {

        vscode.window.showErrorMessage(

          "EditCore Plan: " + (err instanceof Error ? err.message : String(err))

        );

      }

    }),



    vscode.commands.registerCommand("editcore.evolution.runPhase", async () => {

      const pick = await vscode.window.showQuickPick(

        Array.from({ length: 10 }, (_, i) => {

          const id = i + 1;

          return { label: "Fase " + id, description: "Ejecutar fase " + id + " del roadmap" };

        }),

        { title: "Fase a ejecutar (una a la vez)" }

      );

      if (!pick) {

        return;

      }

      const phaseId = Number(pick.label.replace("Fase ", ""));

      try {

        const result = await vscode.window.withProgress(

          {

            location: vscode.ProgressLocation.Notification,

            title: "EditCore: ejecutando fase " + phaseId + "...",

            cancellable: false,

          },

          () => runEvolutionPhase(context, apiKeyService, phaseId)

        );

        await openMarkdownBeside(result.markdown);

        vscode.window.showInformationMessage(

          "Fase " + phaseId + " completada. Revisa REPORTE y SIGUIENTE_PROMPT en .editcore/docs/"

        );

      } catch (err: unknown) {

        vscode.window.showErrorMessage(

          "EditCore Fase: " + (err instanceof Error ? err.message : String(err))

        );

      }

    }),



    vscode.commands.registerCommand("editcore.autonomy.setLevel", async () => {

      const current = getAutonomyLevel();

      const pick = await vscode.window.showQuickPick(

        AUTONOMY_LEVELS.map((l) => ({

          label: "Nivel " + l.level + ": " + l.label,

          description: l.description,

          level: l.level,

        })),

        { title: "Nivel de autonomía (actual: " + current + ")" }

      );

      if (!pick) {

        return;

      }

      await vscode.workspace

        .getConfiguration("editcore")

        .update("autonomy.level", pick.level, vscode.ConfigurationTarget.Workspace);

      vscode.window.showInformationMessage("Autonomía nivel " + pick.level + " activado.");

    }),



    vscode.commands.registerCommand("editcore.evolution.cycle", async () => {

      try {

        await generateImplementationPlan(context, apiKeyService);

        const result = await vscode.window.withProgress(

          {

            location: vscode.ProgressLocation.Notification,

            title: "EditCore: ciclo de evolución completo...",

            cancellable: false,

          },

          () => runEvolutionCycle(context, apiKeyService)

        );



        await openMarkdownBeside(result.markdown);



        const open = await vscode.window.showInformationMessage(

          "Ciclo completado. Artefactos en .editcore/docs/ y docs/",

          "PLAN",

          "SIGUIENTE_PROMPT",

          "REPORTE"

        );

        if (open === "PLAN") {

          const folder = vscode.workspace.workspaceFolders?.[0];

          if (folder) {

            try {

              const doc = await vscode.workspace.openTextDocument(

                vscode.Uri.joinPath(folder.uri, ".editcore", "docs", "PLAN_IMPLEMENTACION_EDITCORE.md")

              );

              await vscode.window.showTextDocument(doc);

            } catch {

              /* optional */

            }

          }

        } else if (open === "SIGUIENTE_PROMPT" && result.evolutionPromptPath) {

          await openFilePath(result.evolutionPromptPath);

        } else if (open === "REPORTE" && result.changeReportPath) {

          await openFilePath(result.changeReportPath);

        }

      } catch (err: unknown) {

        const message = err instanceof Error ? err.message : String(err);

        vscode.window.showErrorMessage("EditCore Evolution: " + message);

      }

    }),



    vscode.commands.registerCommand("editcore.evolution.openNextPrompt", async () => {

      const folder = vscode.workspace.workspaceFolders?.[0];

      if (!folder) {

        return;

      }

      const uri = vscode.Uri.joinPath(

        folder.uri,

        ".editcore",

        "docs",

        "SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md"

      );

      try {

        const doc = await vscode.workspace.openTextDocument(uri);

        await vscode.window.showTextDocument(doc);

      } catch {

        vscode.window.showWarningMessage(

          "Ejecuta editcore.evolution.cycle o editcore.evolution.runPhase primero."

        );

      }

    }),



    vscode.commands.registerCommand("editcore.evolution.openPlan", async () => {

      const folder = vscode.workspace.workspaceFolders?.[0];

      if (!folder) {

        return;

      }

      const uri = vscode.Uri.joinPath(

        folder.uri,

        ".editcore",

        "docs",

        "PLAN_IMPLEMENTACION_EDITCORE.md"

      );

      try {

        const doc = await vscode.workspace.openTextDocument(uri);

        await vscode.window.showTextDocument(doc);

      } catch {

        await vscode.commands.executeCommand("editcore.evolution.generatePlan");

      }

    })

  );

}



let continuousTimer: ReturnType<typeof setInterval> | undefined;



export function scheduleContinuousEvolution(

  context: vscode.ExtensionContext,

  apiKeyService: ApiKeyService

): void {

  const config = vscode.workspace.getConfiguration("editcore");

  const minutes = config.get<number>("evolution.continuousIntervalMinutes", 0);

  const level = getAutonomyLevel();



  if (continuousTimer) {

    clearInterval(continuousTimer);

    continuousTimer = undefined;

  }



  if (minutes <= 0 || level < 5) {

    return;

  }



  continuousTimer = setInterval(

    () => {

      void (async () => {

        const useAde = config.get<boolean>("autonomous.continuousEnabled", true);

        if (useAde) {

          const { loadAutonomyQueue } = await import("../autonomy/taskQueue");

          const queue = await loadAutonomyQueue();

          const next = queue?.tasks.find((t) => t.status === "pending");

          if (next) {

            const { runAutonomousTaskEngine } = await import("../autonomous/taskEngine");

            await runAutonomousTaskEngine(context, apiKeyService, {

              objective: next.title,

            }).catch(() => undefined);

            return;

          }

        }

        await runEvolutionCycle(context, apiKeyService).catch(() => undefined);

      })();

    },

    minutes * 60 * 1000

  );



  context.subscriptions.push({

    dispose: () => {

      if (continuousTimer) {

        clearInterval(continuousTimer);

      }

    },

  });

}


