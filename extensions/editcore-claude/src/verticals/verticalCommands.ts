import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { copyScaffoldTree } from './scaffoldService';

async function resolveTemplateDir(templateId: string): Promise<string> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error('Abre un workspace primero.');
  }
  const templateDir = path.join(root, '.editcore', 'templates', templateId);
  try {
    await fs.promises.access(path.join(templateDir, 'README.md'));
    return templateDir;
  } catch {
    throw new Error(`Instala primero "${templateId}" desde EditCore Marketplace.`);
  }
}

export async function scaffoldVertical(templateId: string): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }

  const templateDir = await resolveTemplateDir(templateId);
  const readme = await fs.promises.readFile(path.join(templateDir, 'README.md'), 'utf8');

  const destChoice = await vscode.window.showQuickPick(
    [
      { label: 'Carpeta scaffold/', description: `scaffold/${templateId}/`, value: 'scaffold' },
      { label: 'Raíz del workspace', description: 'Fusionar en la raíz (no sobrescribe)', value: 'root' },
    ],
    { placeHolder: '¿Dónde copiar la plantilla?' }
  );
  if (!destChoice) return;

  const destDir =
    destChoice.value === 'root' ? root : path.join(root, 'scaffold', templateId);

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Scaffolding ${templateId}...` },
    () => copyScaffoldTree(templateDir, destDir, { overwrite: false })
  );

  const docsDir = path.join(root, 'docs', 'verticals');
  await fs.promises.mkdir(docsDir, { recursive: true });
  await fs.promises.writeFile(path.join(docsDir, `${templateId}.md`), readme, 'utf8');

  const msg =
    result.copied.length > 0
      ? `Plantilla copiada: ${result.copied.length} archivos → ${path.relative(root, destDir)}`
      : 'Sin archivos nuevos (ya existían).';
  if (result.skipped.length > 0) {
    vscode.window.showInformationMessage(`${msg} · ${result.skipped.length} omitidos.`);
  } else {
    vscode.window.showInformationMessage(msg);
  }

  const isGps = templateId.includes('gps');
  const role = isGps ? '@gps' : '@saas';
  const rel = path.relative(root, destDir).replace(/\\/g, '/');
  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: `@claude ${role} Implementá el MVP según docs/verticals/${templateId}.md en ${rel}/`,
  });
}

export async function saasBuilder(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }
  const installed = path.join(root, '.editcore', 'templates', 'template-saas-starter');
  try {
    await fs.promises.access(installed);
    await scaffoldVertical('template-saas-starter');
    return;
  } catch {
    // no instalado
  }
  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query:
      '@claude @saas Diseñá e implementá un MVP SaaS multi-tenant: auth JWT, roles, API Fastify, frontend React, Postgres. Instalá template-saas-starter del Marketplace si hace falta.',
  });
}

export async function gpsBuilder(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }
  const installed = path.join(root, '.editcore', 'templates', 'template-gps-platform');
  try {
    await fs.promises.access(installed);
    await scaffoldVertical('template-gps-platform');
    return;
  } catch {
    // no instalado
  }
  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query:
      '@claude @gps Implementá MVP plataforma GPS: ingesta TCP stub, API posiciones, dashboard mapa. Instalá template-gps-platform del Marketplace si hace falta.',
  });
}

export async function founderMode(): Promise<void> {
  const idea = await vscode.window.showInputBox({
    prompt: 'Describe tu idea de negocio o producto',
    placeHolder: 'ej: SaaS de gestión de flotas GPS para PYMEs en LATAM',
  });
  if (!idea?.trim()) return;

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: `@claude @founder Analizá esta idea y generá MVP, mercado, competencia, modelo de negocio, roadmap y costos:\n\n${idea}`,
  });
}

export async function ctoMode(): Promise<void> {
  const topic = await vscode.window.showInputBox({
    prompt: 'Tema ejecutivo / técnico para modo CTO',
    placeHolder: 'ej: ¿Escalamos a microservicios o mantenemos monolito?',
  });
  if (!topic?.trim()) return;

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: `@claude @cto Modo CTO — analizá escalabilidad, costos, seguridad, arquitectura y roadmap:\n\n${topic}`,
  });
}

export async function showAuditLog(): Promise<void> {
  const { readRecentAudit } = await import('../enterprise/orgConfig');
  const lines = await readRecentAudit(30);
  if (lines.length === 0) {
    vscode.window.showInformationMessage('Sin entradas en .editcore/audit.jsonl aún.');
    return;
  }
  const doc = await vscode.workspace.openTextDocument({
    content: lines.join('\n'),
    language: 'json',
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
