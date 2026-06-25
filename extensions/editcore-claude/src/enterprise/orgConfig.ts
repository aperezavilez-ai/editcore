import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type EditCorePlan = 'free' | 'pro' | 'team' | 'business' | 'enterprise';

export interface OrgConfig {
  name: string;
  plan: EditCorePlan;
  members?: Array<{ email: string; role: 'owner' | 'admin' | 'member' | 'viewer' }>;
}

export async function loadOrgConfig(): Promise<OrgConfig | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return undefined;
  const p = path.join(root, '.editcore', 'org.json');
  try {
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw) as OrgConfig;
  } catch {
    return undefined;
  }
}

export async function getEffectivePlan(): Promise<EditCorePlan> {
  const org = await loadOrgConfig();
  if (org?.plan) {
    return org.plan;
  }
  return vscode.workspace.getConfiguration('editcore').get<EditCorePlan>('plan', 'free');
}

export async function appendAudit(entry: Record<string, unknown>): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return;
  const dir = path.join(root, '.editcore');
  await fs.promises.mkdir(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  await fs.promises.appendFile(path.join(dir, 'audit.jsonl'), line, 'utf8');
}

export async function initOrgConfig(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }
  const dest = path.join(root, '.editcore', 'org.json');
  try {
    await fs.promises.access(dest);
    const open = await vscode.window.showWarningMessage(
      'Ya existe .editcore/org.json',
      'Abrir'
    );
    if (open === 'Abrir') {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(dest));
      await vscode.window.showTextDocument(doc);
    }
    return;
  } catch {
    // crear
  }
  const template = {
    name: path.basename(root),
    plan: await getEffectivePlan(),
    members: [{ email: 'owner@local', role: 'owner' as const }],
  };
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, JSON.stringify(template, null, 2), 'utf8');
  vscode.window.showInformationMessage('EditCore: org.json creado en .editcore/');
}

export async function readRecentAudit(limit = 50): Promise<string[]> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return [];
  const p = path.join(root, '.editcore', 'audit.jsonl');
  try {
    const raw = await fs.promises.readFile(p, 'utf8');
    return raw.trim().split('\n').slice(-limit).reverse();
  } catch {
    return [];
  }
}
