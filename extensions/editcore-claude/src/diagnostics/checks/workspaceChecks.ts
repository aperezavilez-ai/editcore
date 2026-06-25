import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import { DiagnosticFinding } from '../diagnosticTypes';

export async function runWorkspaceChecks(): Promise<DiagnosticFinding[]> {
  const findings: DiagnosticFinding[] = [];
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (!folder) {
    findings.push({
      id: 'ws.none',
      category: 'workspace',
      severity: 'warning',
      title: 'Sin workspace abierto',
      message: 'No hay carpeta de proyecto abierta.',
      hint: 'Abrí una carpeta para diagnóstico del proyecto.',
    });
    return findings;
  }

  const root = folder.uri.fsPath;
  findings.push({
    id: 'ws.open',
    category: 'workspace',
    severity: 'ok',
    title: 'Workspace',
    message: `${folder.name} — ${root}`,
  });

  findings.push(...collectIdeDiagnostics());
  findings.push(...await checkGit(root));
  findings.push(...await checkEditcoreFolder(root));
  findings.push(...await checkProjectManifests(root));

  return findings;
}

function collectIdeDiagnostics(): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const all = vscode.languages.getDiagnostics();
  let errors = 0;
  let warnings = 0;
  const samples: string[] = [];

  for (const [uri, diags] of all) {
    if (uri.scheme !== 'file') {
      continue;
    }
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) {
        errors++;
        if (samples.length < 8) {
          const rel = vscode.workspace.asRelativePath(uri);
          samples.push(`${rel}:${d.range.start.line + 1} — ${d.message}`);
        }
      } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
        warnings++;
      }
    }
  }

  if (errors === 0 && warnings === 0) {
    findings.push({
      id: 'ide.problems',
      category: 'project',
      severity: 'ok',
      title: 'Problems del IDE',
      message: 'Sin errores ni advertencias en archivos del workspace.',
    });
  } else {
    findings.push({
      id: 'ide.problems',
      category: 'project',
      severity: errors > 0 ? 'critical' : 'warning',
      title: 'Problems del IDE',
      message: `${errors} error(es), ${warnings} advertencia(s).`,
      hint: samples.length ? samples.join('\n') : 'Revisá la pestaña Problems.',
    });
  }

  return findings;
}

async function checkGit(root: string): Promise<DiagnosticFinding[]> {
  const gitDir = path.join(root, '.git');
  if (!fs.existsSync(gitDir)) {
    return [
      {
        id: 'git.repo',
        category: 'project',
        severity: 'info',
        title: 'Git',
        message: 'No es un repositorio git.',
      },
    ];
  }

  try {
    const status = await execGit('git status --short --branch', root);
    const lines = status.trim().split('\n').filter(Boolean);
    const branchLine = lines[0]?.startsWith('##') ? lines[0] : '';
    const changes = lines.filter((l) => !l.startsWith('##'));
    const dirty = changes.length > 0;

    return [
      {
        id: 'git.repo',
        category: 'project',
        severity: 'ok',
        title: 'Repositorio Git',
        message: branchLine || 'Repositorio git detectado.',
      },
      {
        id: 'git.dirty',
        category: 'project',
        severity: dirty ? 'warning' : 'ok',
        title: 'Cambios sin commit',
        message: dirty
          ? `${changes.length} archivo(s) con cambios.`
          : 'Working tree limpio.',
        hint: dirty ? changes.slice(0, 6).join('\n') : undefined,
      },
    ];
  } catch (err) {
    return [
      {
        id: 'git.repo',
        category: 'project',
        severity: 'warning',
        title: 'Git',
        message: err instanceof Error ? err.message : String(err),
      },
    ];
  }
}

async function checkEditcoreFolder(root: string): Promise<DiagnosticFinding[]> {
  const findings: DiagnosticFinding[] = [];
  const editcoreDir = path.join(root, '.editcore');

  if (!fs.existsSync(editcoreDir)) {
    findings.push({
      id: 'editcore.folder',
      category: 'project',
      severity: 'warning',
      title: 'Carpeta .editcore',
      message: 'No existe .editcore/ en este proyecto.',
      hint: 'EditCore: Inicializar workspace (.editcore)',
    });
    return findings;
  }

  findings.push({
    id: 'editcore.folder',
    category: 'project',
    severity: 'ok',
    title: 'Carpeta .editcore',
    message: 'Presente.',
  });

  const files: Array<{ name: string; id: string; optional?: boolean }> = [
    { name: 'rules.md', id: 'editcore.rules' },
    { name: 'org.json', id: 'editcore.org', optional: true },
    { name: 'mcp.json', id: 'editcore.mcp', optional: true },
    { name: 'graph.json', id: 'editcore.graph', optional: true },
    { name: 'memory.md', id: 'editcore.memory', optional: true },
    { name: 'audit.jsonl', id: 'editcore.audit', optional: true },
  ];

  for (const f of files) {
    const p = path.join(editcoreDir, f.name);
    const exists = fs.existsSync(p);
    findings.push({
      id: f.id,
      category: 'project',
      severity: exists ? 'ok' : f.optional ? 'info' : 'warning',
      title: `.editcore/${f.name}`,
      message: exists ? 'Presente.' : 'No encontrado.',
    });
  }

  const sessionsDir = path.join(editcoreDir, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    const count = fs.readdirSync(sessionsDir).filter((n) => n.endsWith('.json')).length;
    findings.push({
      id: 'editcore.sessions',
      category: 'project',
      severity: 'info',
      title: 'Sesiones de agente',
      message: `${count} sesión(es) guardada(s).`,
    });
  }

  const diagDir = path.join(editcoreDir, 'diagnostics');
  if (fs.existsSync(path.join(diagDir, 'last-run.json'))) {
    findings.push({
      id: 'editcore.last-diagnostic',
      category: 'project',
      severity: 'info',
      title: 'Último autodiagnóstico',
      message: 'Hay un reporte previo en .editcore/diagnostics/last-run.json',
    });
  }

  return findings;
}

async function checkProjectManifests(root: string): Promise<DiagnosticFinding[]> {
  const findings: DiagnosticFinding[] = [];
  const pkgPath = path.join(root, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return findings;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    findings.push({
      id: 'project.package',
      category: 'project',
      severity: 'ok',
      title: 'package.json',
      message: `Proyecto Node: ${pkg.name ?? 'sin nombre'}.`,
    });

    const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].filter((f) =>
      fs.existsSync(path.join(root, f))
    );
    if (lockfiles.length === 0) {
      findings.push({
        id: 'project.lockfile',
        category: 'project',
        severity: 'warning',
        title: 'Lockfile',
        message: 'Sin package-lock.json / yarn.lock / pnpm-lock.yaml.',
        hint: 'Ejecutá npm install para fijar dependencias.',
      });
    } else {
      findings.push({
        id: 'project.lockfile',
        category: 'project',
        severity: 'ok',
        title: 'Lockfile',
        message: lockfiles.join(', '),
      });
    }

    if (pkg.scripts?.test) {
      findings.push({
        id: 'project.test-script',
        category: 'project',
        severity: 'info',
        title: 'Script de tests',
        message: `"test": ${pkg.scripts.test}`,
        hint: 'Podés correr npm test manualmente para validar.',
      });
    }
  } catch (err) {
    findings.push({
      id: 'project.package',
      category: 'project',
      severity: 'critical',
      title: 'package.json',
      message: `JSON inválido: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return findings;
}

function execGit(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      resolve(stdout);
    });
  });
}
