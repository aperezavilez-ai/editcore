import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface AgentSessionRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  task: string;
  role: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  summary?: string;
}

export class AgentSessionStore {
  private sessionsDir(): string | undefined {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return undefined;
    return path.join(root, '.editcore', 'sessions');
  }

  async create(task: string, role: string): Promise<AgentSessionRecord> {
    const dir = this.sessionsDir();
    if (!dir) {
      throw new Error('Sin workspace abierto');
    }
    await fs.promises.mkdir(dir, { recursive: true });
    const rec: AgentSessionRecord = {
      id: `sess_${Date.now()}`,
      startedAt: new Date().toISOString(),
      task: task.slice(0, 500),
      role,
      status: 'running',
      toolCalls: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
    await this.save(rec);
    return rec;
  }

  async update(id: string, patch: Partial<AgentSessionRecord>): Promise<void> {
    const rec = await this.get(id);
    if (!rec) return;
    await this.save({ ...rec, ...patch });
  }

  async get(id: string): Promise<AgentSessionRecord | undefined> {
    const dir = this.sessionsDir();
    if (!dir) return undefined;
    try {
      const raw = await fs.promises.readFile(path.join(dir, `${id}.json`), 'utf8');
      return JSON.parse(raw) as AgentSessionRecord;
    } catch {
      return undefined;
    }
  }

  async list(limit = 20): Promise<AgentSessionRecord[]> {
    const dir = this.sessionsDir();
    if (!dir) return [];
    try {
      const files = await fs.promises.readdir(dir);
      const recs: AgentSessionRecord[] = [];
      for (const f of files.filter((x) => x.endsWith('.json')).slice(-limit)) {
        const raw = await fs.promises.readFile(path.join(dir, f), 'utf8');
        recs.push(JSON.parse(raw));
      }
      return recs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    } catch {
      return [];
    }
  }

  private async save(rec: AgentSessionRecord): Promise<void> {
    const dir = this.sessionsDir();
    if (!dir) return;
    await fs.promises.writeFile(path.join(dir, `${rec.id}.json`), JSON.stringify(rec, null, 2), 'utf8');
  }
}

let singleton: AgentSessionStore | undefined;

export function getSessionStore(): AgentSessionStore {
  if (!singleton) {
    singleton = new AgentSessionStore();
  }
  return singleton;
}

export async function exportSessionsReport(): Promise<void> {
  const store = getSessionStore();
  const sessions = await store.list(50);
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }
  if (sessions.length === 0) {
    vscode.window.showInformationMessage('No hay sesiones para exportar.');
    return;
  }

  const lines = [
    '# EditCore — Sesiones de agente',
    '',
    `Exportado: ${new Date().toISOString()}`,
    '',
    ...sessions.map((s) => {
      return [
        `## ${s.id}`,
        `- **Estado:** ${s.status}`,
        `- **Rol:** ${s.role}`,
        `- **Inicio:** ${s.startedAt}`,
        s.endedAt ? `- **Fin:** ${s.endedAt}` : '',
        `- **Tools:** ${s.toolCalls}`,
        `- **Tokens:** ↑${s.tokensIn} ↓${s.tokensOut}`,
        `- **Tarea:** ${s.task}`,
        s.summary ? `- **Resumen:** ${s.summary}` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ];

  const dest = path.join(root, '.editcore', 'sessions', 'export.md');
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, lines.join('\n'), 'utf8');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(dest));
  await vscode.window.showTextDocument(doc, { preview: true });
  vscode.window.showInformationMessage('Sesiones exportadas a .editcore/sessions/export.md');
}

export async function showSessionsPicker(): Promise<void> {
  const store = getSessionStore();
  const sessions = await store.list();
  if (sessions.length === 0) {
    vscode.window.showInformationMessage('No hay sesiones de agente guardadas aún.');
    return;
  }
  const pick = await vscode.window.showQuickPick(
    sessions.map((s) => ({
      label: `${s.status} · ${s.role} · ${s.task.slice(0, 60)}`,
      description: new Date(s.startedAt).toLocaleString(),
      detail: s.summary,
      session: s,
    })),
    { placeHolder: 'Sesiones de agente (cloud local)' }
  );
  if (!pick) return;

  const action = await vscode.window.showQuickPick(
    [
      { label: 'Continuar en chat', value: 'resume' },
      { label: 'Ver detalle', value: 'detail' },
    ],
    { placeHolder: pick.session.task.slice(0, 50) }
  );
  if (action?.value === 'resume') {
    await resumeSession(pick.session);
  } else if (action?.value === 'detail') {
    const doc = await vscode.workspace.openTextDocument({
      content: JSON.stringify(pick.session, null, 2),
      language: 'json',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

export async function resumeSession(session?: AgentSessionRecord): Promise<void> {
  const store = getSessionStore();
  let rec = session;
  if (!rec) {
    const sessions = await store.list();
    if (sessions.length === 0) {
      vscode.window.showInformationMessage('No hay sesiones para reanudar.');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      sessions.map((s) => ({
        label: `${s.role} · ${s.task.slice(0, 70)}`,
        description: `${s.status} · ${new Date(s.startedAt).toLocaleString()}`,
        session: s,
      })),
      { placeHolder: '¿Qué sesión reanudar?' }
    );
    rec = pick?.session;
  }
  if (!rec) return;

  const roleTag = rec.role !== 'default' ? `@${rec.role} ` : '';
  const contextBlock = rec.summary
    ? `Resumen de la sesión anterior:\n${rec.summary}\n\nTarea original:\n${rec.task}`
    : rec.task;

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: `@claude ${roleTag}Continuá esta tarea (sesión ${rec.id}):\n\n${contextBlock}`,
  });
}
