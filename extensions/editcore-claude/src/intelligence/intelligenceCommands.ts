import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { logEvent } from "../platform/observability";
import { assertIntelligenceEnabled } from "./permissionGate";
import {
  buildHealthReport,
  formatHealthReportMarkdown,
} from "./healthMonitor";
import { runIntelligencePipeline } from "./intelligencePipeline";
import {
  buildSystemSnapshot,
  formatSystemSnapshotJson,
  formatSystemSnapshotMarkdown,
} from "./systemReader";
import {
  gatherCommandCenterData,
  formatCommandCenterMarkdown,
  generateRecommendations,
  saveCommandCenterReport,
} from "./recommendationEngine";

async function openMarkdownReport(markdown: string, title?: string): Promise<void> {
  const content = title ? `# ${title}\n\n${markdown}` : markdown;
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  await vscode.commands.executeCommand("markdown.showPreviewToSide");
}

export function registerIntelligenceCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.intelligence.snapshot", async () => {
      try {
        await assertIntelligenceEnabled();
        const snapshot = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: generando snapshot del sistema...",
            cancellable: false,
          },
          () => buildSystemSnapshot(context, apiKeyService)
        );

        await logEvent(context, "info", "intelligence", "system_snapshot_generated", {
          modules: snapshot.modules.length,
          integrations: snapshot.integrations.length,
        });

        const format = await vscode.window.showQuickPick(
          [
            { label: "Markdown", value: "md" as const },
            { label: "JSON", value: "json" as const },
          ],
          { title: "Formato del snapshot" }
        );
        if (!format) {
          return;
        }

        if (format.value === "json") {
          const doc = await vscode.workspace.openTextDocument({
            content: formatSystemSnapshotJson(snapshot),
            language: "json",
          });
          await vscode.window.showTextDocument(doc, { preview: false });
          return;
        }

        await openMarkdownReport(formatSystemSnapshotMarkdown(snapshot));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`EditCore SIL: ${message}`);
      }
    }),

    vscode.commands.registerCommand("editcore.intelligence.health", async () => {
      try {
        await assertIntelligenceEnabled();
        const report = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: Health Monitor...",
            cancellable: false,
          },
          () => buildHealthReport(context, apiKeyService)
        );

        await logEvent(context, "metric", "intelligence", "health_report_generated", {
          status: report.status,
          critical: report.diagnosticSummary.critical,
          warning: report.diagnosticSummary.warning,
        });

        await openMarkdownReport(formatHealthReportMarkdown(report));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`EditCore SIL: ${message}`);
      }
    }),

    vscode.commands.registerCommand("editcore.intelligence.generateSystemMap", async () => {
      try {
        await assertIntelligenceEnabled();
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: pipeline System Intelligence...",
            cancellable: false,
          },
          () =>
            runIntelligencePipeline(context, apiKeyService, {
              saveSystemMap: true,
              runAnalysis: true,
              recordMemory: true,
            })
        );

        await openMarkdownReport(result.markdown);

        if (result.savedMapPath) {
          const open = await vscode.window.showInformationMessage(
            `Mapa guardado en .editcore/docs/EDITCORE_SYSTEM_MAP.md`,
            "Abrir archivo"
          );
          if (open === "Abrir archivo") {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.savedMapPath));
            await vscode.window.showTextDocument(doc);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`EditCore SIL: ${message}`);
      }
    }),

    vscode.commands.registerCommand("editcore.intelligence.commandCenter", async () => {
      try {
        await assertIntelligenceEnabled();
        const data = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "EditCore: generando Command Center...",
            cancellable: false,
          },
          () => gatherCommandCenterData(context, apiKeyService)
        );

        let markdown = formatCommandCenterMarkdown(data);

        const wantsRecommendations = await vscode.window.showInformationMessage(
          "¿Generar también recomendaciones con IA (llamada real a Claude) además del dashboard local?",
          "Sí, generar",
          "Solo dashboard"
        );
        if (wantsRecommendations === "Sí, generar") {
          const apiKey = (await apiKeyService.getApiKey()) ?? "";
          const recommendations = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "EditCore: generando recomendaciones...",
              cancellable: false,
            },
            () => generateRecommendations(apiKey, data)
          );
          markdown += `\n\n## Recomendaciones (generadas por Claude)\n\n${recommendations}\n`;
        }

        const savedPath = await saveCommandCenterReport(context, markdown);

        await logEvent(context, "info", "intelligence", "command_center_generated", {
          status: data.health.status,
          decisions: data.decisions.totalDecisions,
        });

        await openMarkdownReport(markdown, "Command Center");

        if (data.decisions.cancelRate > 0.4 && data.decisions.totalDecisions >= 5) {
          vscode.window.showWarningMessage(
            `Smart Alert: ${(data.decisions.cancelRate * 100).toFixed(0)}% de las propuestas del agente fueron canceladas. Revisá el Command Center.`
          );
        }
        if (data.health.status === "critical") {
          vscode.window.showWarningMessage("Smart Alert: el Health Monitor reporta estado crítico.");
        }
        if (savedPath) {
          vscode.window.showInformationMessage(`Reporte guardado en ${savedPath}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`EditCore SIL: ${message}`);
      }
    })
  );
}