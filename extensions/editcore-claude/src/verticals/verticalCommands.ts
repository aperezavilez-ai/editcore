import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { copyScaffoldTree } from './scaffoldService';

const BUNDLED_TEMPLATES: Record<string, string> = {
  'template-saas-starter': 'verticals/saas-starter',
  'template-gps-platform': 'verticals/gps-platform',
};

function getBundledTemplateDir(templateId: string): string | undefined {
  const rel = BUNDLED_TEMPLATES[templateId];
  if (!rel) {
    return undefined;
  }
  const ext = vscode.extensions.getExtension('editcore.editcore-claude');
  if (!ext) {
    return undefined;
  }
  return path.join(ext.extensionUri.fsPath, 'marketplace', rel);
}

async function resolveTemplateDir(templateId: string): Promise<string> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error('Abre un workspace primero.');
  }

  const workspaceTemplate = path.join(root, '.editcore', 'templates', templateId);
  try {
    await fs.promises.access(path.join(workspaceTemplate, 'README.md'));
    return workspaceTemplate;
  } catch {
    // continuar
  }

  const bundled = getBundledTemplateDir(templateId);
  if (bundled) {
    try {
      await fs.promises.access(path.join(bundled, 'README.md'));
      return bundled;
    } catch {
      // continuar
    }
  }

  throw new Error(`Plantilla "${templateId}" no encontrada en EditCore.`);
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
  try {
    await resolveTemplateDir('template-saas-starter');
    await scaffoldVertical('template-saas-starter');
  } catch {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query:
        '@claude @saas Diseñá e implementá un MVP SaaS multi-tenant: auth JWT, roles, API Fastify, frontend React, Postgres.',
    });
  }
}

export async function gpsBuilder(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }
  try {
    await resolveTemplateDir('template-gps-platform');
    await scaffoldVertical('template-gps-platform');
  } catch {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query:
        '@claude @gps Implementá MVP plataforma GPS: ingesta TCP stub, API posiciones, dashboard mapa.',
    });
  }
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

export async function generateFromIdea(): Promise<void> {
  const idea = await vscode.window.showInputBox({
    prompt: 'Describe tu idea de app/producto en una línea',
    placeHolder: 'ej: App de turnos para peluquerías con recordatorios por WhatsApp',
  });
  if (!idea?.trim()) return;

  const config = vscode.workspace.getConfiguration('editcore');
  const enabled = config.get<boolean>('multiAgent.enabled', false);
  if (!enabled) {
    const choice = await vscode.window.showInformationMessage(
      'Este generador usa el pipeline multi-agente (Arquitecto → Programador → QA → DevOps → Documentador), real pero más lento y con más consumo de tokens que está desactivado por defecto. ¿Activarlo para esta sesión?',
      { modal: true },
      'Activar'
    );
    if (choice !== 'Activar') return;
    await config.update('multiAgent.enabled', true, vscode.ConfigurationTarget.Global);
  }

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: `@claude ${idea.trim()}`,
  });
}

export async function createCustomAgent(): Promise<void> {
  const { saveCustomAgent } = await import('../agents/roles');
  const { AGENT_TOOLS } = await import('../agent/tools');

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('Abre un workspace primero.');
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'Nombre del agente (se usará como @nombre en el chat)',
    placeHolder: 'ej: redactor-legal',
    validateInput: (v) => (/^[a-z0-9-]+$/i.test(v.trim()) ? undefined : 'Solo letras, números y guiones.'),
  });
  if (!name?.trim()) return;

  const objective = await vscode.window.showInputBox({
    prompt: 'Objetivo / instrucciones del agente (esto se usa como su system prompt)',
    placeHolder: 'ej: Redactá contratos y términos legales en español claro, citando riesgos.',
  });
  if (!objective?.trim()) return;

  const toolPicks = await vscode.window.showQuickPick(
    AGENT_TOOLS.map((t) => ({ label: t.name, description: t.description, picked: true })),
    {
      canPickMany: true,
      placeHolder: 'Tools permitidas para este agente (todas marcadas = sin restricción)',
    }
  );
  const allowedTools =
    toolPicks && toolPicks.length > 0 && toolPicks.length < AGENT_TOOLS.length
      ? toolPicks.map((p) => p.label)
      : undefined;

  await saveCustomAgent({
    id: name.trim().toLowerCase(),
    label: name.trim(),
    systemPrompt: objective.trim(),
    allowedTools,
  });
  const restriction = allowedTools ? ` (limitado a: ${allowedTools.join(', ')})` : ' (sin restricción de tools)';
  vscode.window.showInformationMessage(
    `Agente @${name.trim().toLowerCase()} guardado en .editcore/agents.json${restriction}. Usalo en el chat con @${name.trim().toLowerCase()}.`
  );
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
