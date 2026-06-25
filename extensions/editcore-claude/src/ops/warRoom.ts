import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { buildAgentContext } from '../agent/agentContext';
import { runAgentTask, AgentEvent } from '../agent/agentLoop';

const execAsync = promisify(exec);

export async function analyzeProductionIssue(
  apiKey: string,
  description: string,
  onEvent: (event: AgentEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (i: number, o: number) => void,
  onToolCall?: (n: string) => void
): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const contextParts: string[] = [`## Incidente reportado\n${description}`];

  if (root) {
    try {
      const { stdout: log } = await execAsync('git log -5 --oneline', { cwd: root, timeout: 10_000 });
      contextParts.push(`## Últimos commits\n${log.trim()}`);
    } catch {
      // sin git
    }
    try {
      const { stdout: status } = await execAsync('git status --short', { cwd: root, timeout: 10_000 });
      contextParts.push(`## Git status\n${status.trim() || '(limpio)'}`);
    } catch {
      // sin git
    }
  }

  const task = await buildAgentContext(
    `${contextParts.join('\n\n')}\n\nAnalizá causa probable, archivos sospechosos y plan de mitigación. Usá tools si hace falta.`
  );

  onEvent({
    type: 'assistant_text',
    text: '🚨 **Sala de guerra** — analizando incidente…\n\n',
  });

  await runAgentTask(apiKey, task, onEvent, abortSignal, onUsage, onToolCall);
}

export async function runAutonomousDeploy(): Promise<void> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }

  const steps = [
    { label: 'Tests (npm test)', cmd: 'npm test' },
    { label: 'Build (npm run build)', cmd: 'npm run build' },
  ];

  const approve = await vscode.window.showWarningMessage(
    'Deploy autónomo EditCore: ejecutará tests, build y luego Vercel (EditCore Connect) si todo pasa.',
    { modal: true },
    'Continuar',
    'Cancelar'
  );
  if (approve !== 'Continuar') {
    return;
  }

  for (const step of steps) {
    try {
      const pkg = await readPackageScripts(cwd);
      if (step.cmd === 'npm test' && !pkg.test) {
        continue;
      }
      if (step.cmd === 'npm run build' && !pkg.build) {
        continue;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: step.label },
        () => execAsync(step.cmd, { cwd, timeout: 300_000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Deploy abortado en "${step.label}": ${msg}`);
      return;
    }
  }

  await vscode.commands.executeCommand('editcoreConnect.deployVercel');
  vscode.window.showInformationMessage('Pipeline local OK — deploy delegado a EditCore Connect.');
}

async function readPackageScripts(cwd: string): Promise<{ test?: string; build?: string }> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const raw = await fs.promises.readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return { test: pkg.scripts?.test, build: pkg.scripts?.build };
  } catch {
    return {};
  }
}
