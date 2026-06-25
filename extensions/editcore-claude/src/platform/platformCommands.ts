import * as vscode from "vscode";
import { runProjectAudit, saveAuditReport, formatAuditMarkdown } from "./auditService";
import { runPostChangeValidation, saveValidationReport, formatValidationMarkdown } from "./postChangeValidator";

export function registerPlatformCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.audit", async () => {
      const report = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "EditCore: auditando proyecto…" },
        () => runProjectAudit()
      );
      if (!report) return;

      const filePath = await saveAuditReport(report);
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc, { preview: false });

      const { critical, warning } = report.summary;
      const msg =
        critical > 0
          ? `Auditoría: ${critical} crítico(s), ${warning} advertencia(s). Guardado en ${filePath}`
          : `Auditoría completa. Guardado en ${filePath}`;
      vscode.window.showInformationMessage(msg);
    }),

    vscode.commands.registerCommand("editcore.validateProject", async () => {
      const report = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "EditCore: validando build/tests…" },
        () => runPostChangeValidation()
      );
      if (!report) {
        vscode.window.showInformationMessage("EditCore: sin comandos de validación detectados.");
        return;
      }
      const filePath = await saveValidationReport(report);
      if (report.allPassed) {
        vscode.window.showInformationMessage(`Validación OK. Reporte: ${filePath}`);
      } else {
        const doc = filePath ? await vscode.workspace.openTextDocument(filePath) : undefined;
        if (doc) await vscode.window.showTextDocument(doc);
        vscode.window.showWarningMessage(`Validación falló. Ver ${filePath}`);
      }
    }),

    vscode.commands.registerCommand("editcore.showLastAudit", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const fs = await import("fs");
      const path = await import("path");
      const reportsDir = path.join(root, ".editcore", "reports");
      if (!fs.existsSync(reportsDir)) {
        vscode.window.showInformationMessage("Sin reportes de auditoría. Ejecutá editcore.audit primero.");
        return;
      }
      const files = fs
        .readdirSync(reportsDir)
        .filter((f) => f.startsWith("audit-") && f.endsWith(".md"))
        .sort()
        .reverse();
      if (!files.length) return;
      const doc = await vscode.workspace.openTextDocument(path.join(reportsDir, files[0]));
      await vscode.window.showTextDocument(doc);
    })
  );
}

export { formatAuditMarkdown, formatValidationMarkdown };
