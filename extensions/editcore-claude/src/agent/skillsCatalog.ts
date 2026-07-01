import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * skillsCatalog.ts — sistema de Skills para EditCore Agent.
 *
 * Replica el patrón de "carga progresiva" de los Skills de Anthropic:
 * 1. Al construir el system prompt, solo se inyecta nombre + descripción
 *    de cada skill disponible (barato, ~30-50 tokens por skill).
 * 2. El agente decide POR SÍ MISMO si una skill aplica a la tarea actual.
 * 3. Si aplica, usa la tool `read_skill` para cargar el SKILL.md completo
 *    (contenido pesado) solo en ese momento — nunca se manda si no se usa.
 *
 * Dos fuentes de skills:
 * - "bundled": carpeta `skills/` dentro de la extensión — capacidades
 *   propias de EditCore (ej. cómo usar EditCore Connect, autodiagnóstico).
 *   Aplican en cualquier proyecto.
 * - "workspace": carpeta `.editcore/skills/` dentro del proyecto abierto —
 *   skills específicas de ese proyecto, escritas por el usuario o el equipo.
 *
 * Si un nombre de skill existe en ambos lados, gana la del workspace
 * (permite al usuario sobreescribir una skill built-in si lo necesita).
 */

export interface SkillEntry {
  name: string;
  description: string;
  source: 'bundled' | 'workspace';
  filePath: string;
}

function getBundledSkillsDir(): string | undefined {
  const ext = vscode.extensions.getExtension('editcore.editcore-claude');
  if (!ext) return undefined;
  return path.join(ext.extensionUri.fsPath, 'skills');
}

function getWorkspaceSkillsDir(): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return undefined;
  return path.join(root, '.editcore', 'skills');
}

function parseFrontmatter(raw: string): { name?: string; description?: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const nameMatch = block.match(/^name:\s*(.+)\s*$/m);
  const descMatch = block.match(/^description:\s*(.+)\s*$/m);
  return {
    name: nameMatch?.[1]?.trim().replace(/^["']|["']$/g, ''),
    description: descMatch?.[1]?.trim().replace(/^["']|["']$/g, ''),
  };
}

async function scanSkillsDir(dir: string, source: 'bundled' | 'workspace'): Promise<SkillEntry[]> {
  const results: SkillEntry[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(dir, entry.name, 'SKILL.md');
    try {
      const raw = await fs.promises.readFile(skillFile, 'utf8');
      const { name, description } = parseFrontmatter(raw);
      if (!name || !description) continue;
      results.push({ name, description, source, filePath: skillFile });
    } catch {
      // sin SKILL.md válido en esa carpeta — se ignora
    }
  }
  return results;
}

/** Lista todas las skills disponibles (bundled + workspace, sin duplicar nombres). */
export async function listAvailableSkills(): Promise<SkillEntry[]> {
  const bundledDir = getBundledSkillsDir();
  const workspaceDir = getWorkspaceSkillsDir();

  const [bundled, workspace] = await Promise.all([
    bundledDir ? scanSkillsDir(bundledDir, 'bundled') : Promise.resolve([]),
    workspaceDir ? scanSkillsDir(workspaceDir, 'workspace') : Promise.resolve([]),
  ]);

  const byName = new Map<string, SkillEntry>();
  for (const skill of bundled) byName.set(skill.name, skill);
  for (const skill of workspace) byName.set(skill.name, skill); // workspace tiene prioridad
  return Array.from(byName.values());
}

/** Bloque de catálogo (solo nombre + descripción) para inyectar en el system prompt. */
export async function buildSkillsCatalogPrompt(): Promise<string> {
  const skills = await listAvailableSkills();
  if (skills.length === 0) return '';

  const lines = skills.map((s) => `- ${s.name}: ${s.description}`);
  return (
    `Skills disponibles (cárgalas con la tool read_skill SOLO si la tarea actual las necesita; ` +
    `no las menciones al usuario ni las cargues "por si acaso"):\n` +
    lines.join('\n')
  );
}

/** Lee el contenido completo de una skill por nombre. Usado por la tool read_skill. */
export async function readSkillContent(name: string): Promise<string | undefined> {
  const skills = await listAvailableSkills();
  const skill = skills.find((s) => s.name === name);
  if (!skill) return undefined;
  try {
    return await fs.promises.readFile(skill.filePath, 'utf8');
  } catch {
    return undefined;
  }
}
