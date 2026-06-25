export type DiagnosticSeverity = 'critical' | 'warning' | 'info' | 'ok';

export type DiagnosticCategory = 'editcore' | 'workspace' | 'project';

export interface DiagnosticFinding {
  id: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  title: string;
  message: string;
  hint?: string;
}

export interface DiagnosticSummary {
  critical: number;
  warning: number;
  info: number;
  ok: number;
  total: number;
}

export interface DiagnosticReport {
  generatedAt: string;
  durationMs: number;
  extensionVersion: string;
  vscodeVersion: string;
  workspaceName?: string;
  workspacePath?: string;
  findings: DiagnosticFinding[];
  summary: DiagnosticSummary;
  claudeAnalysis?: string;
  usedClaude: boolean;
}

export function summarizeFindings(findings: DiagnosticFinding[]): DiagnosticSummary {
  const summary: DiagnosticSummary = {
    critical: 0,
    warning: 0,
    info: 0,
    ok: 0,
    total: findings.length,
  };
  for (const f of findings) {
    summary[f.severity]++;
  }
  return summary;
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

export function sortFindingsBySeverity(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

export function reportToMarkdown(report: DiagnosticReport): string {
  const lines: string[] = [
    `# EditCore Autodiagnóstico`,
    '',
    `**Generado:** ${report.generatedAt}`,
    `**Duración:** ${report.durationMs} ms`,
    `**Extensión:** v${report.extensionVersion} · **VS Code:** ${report.vscodeVersion}`,
  ];
  if (report.workspacePath) {
    lines.push(`**Workspace:** ${report.workspaceName ?? report.workspacePath}`);
    lines.push(`\`${report.workspacePath}\``);
  }
  lines.push(
    '',
    `## Resumen`,
    '',
    `| Severidad | Cantidad |`,
    `|-----------|----------|`,
    `| Crítico | ${report.summary.critical} |`,
    `| Advertencia | ${report.summary.warning} |`,
    `| Info | ${report.summary.info} |`,
    `| OK | ${report.summary.ok} |`,
    '',
    `## Hallazgos`,
    ''
  );

  for (const f of sortFindingsBySeverity(report.findings)) {
    const badge = severityEmoji(f.severity);
    lines.push(`### ${badge} ${f.title} (\`${f.id}\`)`);
    lines.push('');
    lines.push(`- **Categoría:** ${f.category}`);
    lines.push(`- **Detalle:** ${f.message}`);
    if (f.hint) {
      lines.push(`- **Sugerencia:** ${f.hint}`);
    }
    lines.push('');
  }

  if (report.claudeAnalysis) {
    lines.push('## Análisis Claude', '', report.claudeAnalysis, '');
  }

  return lines.join('\n');
}

function severityEmoji(severity: DiagnosticSeverity): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
    default:
      return '🟢';
  }
}
