import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ApiKeyService } from '../apiKeyService';
import { callWithFallback } from '../aiRouter';
import { appendAudit } from '../enterprise/orgConfig';
import { runEditcoreChecks } from './checks/editcoreChecks';
import { runWorkspaceChecks } from './checks/workspaceChecks';
import {
  DiagnosticReport,
  reportToMarkdown,
  summarizeFindings,
} from './diagnosticTypes';
import { buildDiagnosticUserMessage, DIAGNOSTIC_SYSTEM_PROMPT } from './diagnosticPrompt';

let lastReport: DiagnosticReport | undefined;

export function getLastDiagnosticReport(): DiagnosticReport | undefined {
  return lastReport;
}

export interface RunDiagnosticOptions {
  useClaude?: boolean;
  showPanel?: boolean;
  showNotification?: boolean;
}

export async function runSelfDiagnostic(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  options: RunDiagnosticOptions = {}
): Promise<DiagnosticReport> {
  const config = vscode.workspace.getConfiguration('editcore');
  const useClaude = options.useClaude ?? config.get<boolean>('diagnostics.useClaude', true);
  const showPanel = options.showPanel ?? true;
  const showNotification = options.showNotification ?? true;

  const started = Date.now();
  const findings = [
    ...(await runEditcoreChecks(context, apiKeyService)),
    ...(await runWorkspaceChecks()),
  ];

  const folder = vscode.workspace.workspaceFolders?.[0];
  const report: DiagnosticReport = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    extensionVersion: String(context.extension.packageJSON.version ?? '?'),
    vscodeVersion: vscode.version,
    workspaceName: folder?.name,
    workspacePath: folder?.uri.fsPath,
    findings,
    summary: summarizeFindings(findings),
    usedClaude: false,
  };

  if (useClaude) {
    const hasKey = await apiKeyService.hasAnyLlmKey();
    if (hasKey) {
      try {
        report.claudeAnalysis = await analyzeWithLlm(apiKeyService, report);
        report.usedClaude = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        findings.push({
          id: 'claude.analysis',
          category: 'editcore',
          severity: 'warning',
          title: 'Análisis Claude',
          message: `No se pudo completar: ${msg}`,
          hint: 'Revisá API Key y conexión. El reporte local sigue disponible.',
        });
        report.summary = summarizeFindings(findings);
      }
    } else {
      findings.push({
        id: 'claude.skipped',
        category: 'editcore',
        severity: 'info',
        title: 'Análisis IA omitido',
        message: 'Sin API Key — solo checks locales.',
        hint: 'Configurá API Key (Anthropic u OpenAI) para análisis automático.',
      });
      report.summary = summarizeFindings(findings);
    }
  }

  report.durationMs = Date.now() - started;
  lastReport = report;

  await persistReport(report);

  if (showPanel) {
    const { DiagnosticPanel } = await import('./diagnosticPanel');
    DiagnosticPanel.show(report);
  }

  if (showNotification) {
    const { critical, warning } = report.summary;
    if (critical > 0) {
      vscode.window.showWarningMessage(
        `Autodiagnóstico: ${critical} crítico(s), ${warning} advertencia(s). Ver panel.`
      );
    } else if (warning > 0) {
      vscode.window.showInformationMessage(
        `Autodiagnóstico: ${warning} advertencia(s). Ver panel para detalles.`
      );
    } else {
      vscode.window.showInformationMessage('Autodiagnóstico: todo OK.');
    }
  }

  return report;
}

async function analyzeWithLlm(
  apiKeyService: ApiKeyService,
  report: DiagnosticReport
): Promise<string> {
  const { text, usage } = await callWithFallback(apiKeyService, [
    {
      role: 'user',
      content: `${DIAGNOSTIC_SYSTEM_PROMPT}\n\n${buildDiagnosticUserMessage(report)}`,
    },
  ]);
  apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);
  return text || '(Sin análisis de texto)';
}

async function persistReport(report: DiagnosticReport): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return;
  }
  const dir = path.join(root, '.editcore', 'diagnostics');
  await fs.promises.mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, 'last-run.json');
  const mdPath = path.join(dir, 'last-run.md');
  await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.promises.writeFile(mdPath, reportToMarkdown(report), 'utf8');

  await appendAudit({
    action: 'self_diagnostic',
    critical: report.summary.critical,
    warning: report.summary.warning,
    usedClaude: report.usedClaude,
  });
}

export async function exportLastDiagnostic(): Promise<void> {
  if (!lastReport) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      const p = path.join(root, '.editcore', 'diagnostics', 'last-run.md');
      if (fs.existsSync(p)) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
        await vscode.window.showTextDocument(doc);
        return;
      }
    }
    vscode.window.showWarningMessage('Ejecutá Autodiagnóstico primero.');
    return;
  }

  const md = reportToMarkdown(lastReport);
  const doc = await vscode.workspace.openTextDocument({ content: md, language: 'markdown' });
  await vscode.window.showTextDocument(doc, { preview: false });
}

export async function runQuickDiagnostic(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<DiagnosticReport> {
  return runSelfDiagnostic(context, apiKeyService, {
    useClaude: false,
    showPanel: true,
  });
}
