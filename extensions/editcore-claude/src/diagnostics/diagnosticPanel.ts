import * as vscode from 'vscode';
import { DiagnosticReport, sortFindingsBySeverity } from './diagnosticTypes';

export class DiagnosticPanel {
  private static current: DiagnosticPanel | undefined;

  static show(report: DiagnosticReport): void {
    if (DiagnosticPanel.current) {
      DiagnosticPanel.current.update(report);
      DiagnosticPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'editcoreDiagnostic',
      'EditCore Autodiagnóstico',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    DiagnosticPanel.current = new DiagnosticPanel(panel, report);
    panel.onDidDispose(() => {
      DiagnosticPanel.current = undefined;
    });
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    report: DiagnosticReport
  ) {
    this.panel.webview.html = renderHtml(report);
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'openChat') {
        void vscode.commands.executeCommand('workbench.action.chat.open', {
          query: '@claude Revisá el último autodiagnóstico EditCore y ayudame a resolver los problemas críticos.',
        });
      } else if (msg.type === 'export') {
        void vscode.commands.executeCommand('editcore.selfDiagnostic.export');
      } else if (msg.type === 'rerun') {
        void vscode.commands.executeCommand('editcore.selfDiagnostic');
      }
    });
  }

  update(report: DiagnosticReport): void {
    this.panel.webview.html = renderHtml(report);
  }
}

function renderHtml(report: DiagnosticReport): string {
  const findings = sortFindingsBySeverity(report.findings);
  const findingRows = findings
    .map(
      (f) => `
    <div class="finding ${f.severity}">
      <div class="finding-head">
        <span class="badge">${f.severity}</span>
        <strong>${escapeHtml(f.title)}</strong>
        <span class="cat">${escapeHtml(f.category)}</span>
      </div>
      <p>${escapeHtml(f.message)}</p>
      ${f.hint ? `<p class="hint">${escapeHtml(f.hint)}</p>` : ''}
    </div>`
    )
    .join('');

  const claudeBlock = report.claudeAnalysis
    ? `<section class="claude"><h2>Análisis Claude</h2><pre>${escapeHtml(report.claudeAnalysis)}</pre></section>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px 20px; line-height: 1.45; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    .meta { opacity: 0.85; font-size: 0.9rem; margin-bottom: 16px; }
    .summary { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
    .pill { padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--vscode-panel-border); }
    .pill.critical { border-color: #e51400; color: #ff6b6b; }
    .pill.warning { border-color: #bf8803; color: #ffd166; }
    .pill.info { border-color: #3794ff; color: #79b8ff; }
    .pill.ok { border-color: #3fb950; color: #3fb950; }
    .actions { margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .finding { border-left: 3px solid var(--vscode-panel-border); padding: 10px 12px; margin-bottom: 10px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 0 6px 6px 0; }
    .finding.critical { border-left-color: #e51400; }
    .finding.warning { border-left-color: #bf8803; }
    .finding.info { border-left-color: #3794ff; }
    .finding.ok { border-left-color: #3fb950; }
    .finding-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .badge { font-size: 0.7rem; text-transform: uppercase; opacity: 0.9; }
    .cat { font-size: 0.75rem; opacity: 0.65; margin-left: auto; }
    .hint { font-size: 0.85rem; opacity: 0.9; font-style: italic; }
    .claude pre { white-space: pre-wrap; background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Autodiagnóstico EditCore</h1>
  <div class="meta">
    ${escapeHtml(report.generatedAt)} · ${report.durationMs} ms ·
    v${escapeHtml(report.extensionVersion)} · VS Code ${escapeHtml(report.vscodeVersion)}
    ${report.workspaceName ? ` · <strong>${escapeHtml(report.workspaceName)}</strong>` : ''}
    ${report.usedClaude ? ' · <em>con análisis Claude</em>' : ' · <em>solo checks locales</em>'}
  </div>
  <div class="summary">
    <span class="pill critical">${report.summary.critical} crítico(s)</span>
    <span class="pill warning">${report.summary.warning} advertencia(s)</span>
    <span class="pill info">${report.summary.info} info</span>
    <span class="pill ok">${report.summary.ok} OK</span>
  </div>
  <div class="actions">
    <button onclick="rerun()">Volver a ejecutar</button>
    <button class="secondary" onclick="exportMd()">Exportar Markdown</button>
    <button class="secondary" onclick="openChat()">Abrir chat @claude</button>
  </div>
  <section><h2>Hallazgos (${report.findings.length})</h2>${findingRows}</section>
  ${claudeBlock}
  <script>
    const vscode = acquireVsCodeApi();
    function rerun() { vscode.postMessage({ type: 'rerun' }); }
    function exportMd() { vscode.postMessage({ type: 'export' }); }
    function openChat() { vscode.postMessage({ type: 'openChat' }); }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
