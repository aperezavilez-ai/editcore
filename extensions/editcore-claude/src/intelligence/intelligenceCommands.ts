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

async function openMarkdownReport(markdown: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
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
    })
  );
}
