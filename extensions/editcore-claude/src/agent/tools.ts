/**
 * tools.ts — herramientas del Agent Mode de EditCore.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { requestCommandApproval } from './terminalApproval';
import { analyzeFileImpact, formatImpactReport } from './impactAnalyzer';
import { loadDependencyGraph, formatGraphAnswer } from '../twin/dependencyGraph';
import { McpManager } from '../mcp/mcpClient';
import { isReadableFile } from '../fs/workspaceFs';

export type ToolCallRecorder = (name: string) => void;

let toolCallRecorder: ToolCallRecorder | undefined;

export function setToolCallRecorder(recorder: ToolCallRecorder | undefined): void {
  toolCallRecorder = recorder;
}

// ---------------------------------------------------------------------------
// Definición Anthropic
// ---------------------------------------------------------------------------

export const AGENT_TOOLS = [
  {
    name: 'list_directory',
    description: 'Lista archivos y carpetas en una ruta relativa al workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta relativa ("." = raíz).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Lee un archivo de texto con números de línea.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        offset: { type: 'number', description: 'Línea inicial (1-based, opcional).' },
        limit: { type: 'number', description: 'Máximo de líneas (opcional).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description:
      'Busca un patrón regex en archivos del workspace. Devuelve coincidencias con ruta y línea.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Expresión regular (sin flags).' },
        path: { type: 'string', description: 'Subcarpeta opcional, ej: "src".' },
        max_results: { type: 'number', description: 'Máximo resultados (default 40).' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'glob_files',
    description: 'Encuentra archivos por patrón glob, ej: "**/*.ts", "src/**/*.json".',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        max_results: { type: 'number' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'write_file',
    description:
      'Crea o reescribe un archivo completo. Requiere aprobación del usuario (diff).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'apply_patch',
    description:
      'Reemplaza old_string por new_string en un archivo existente. Requiere aprobación (diff). ' +
      'old_string debe ser único en el archivo.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'run_command',
    description: 'Ejecuta un comando en la raíz del workspace. Requiere aprobación.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Muestra git status --short en el workspace.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'git_diff',
    description: 'Muestra git diff (opcionalmente de un archivo).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Archivo relativo opcional.' },
        staged: { type: 'boolean', description: 'Si true, diff --cached.' },
      },
    },
  },
  {
    name: 'git_commit',
    description: 'Crea un commit con los cambios staged. Requiere aprobación.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_push',
    description: 'Hace git push al remoto (por defecto origin). Requiere aprobación.',
    input_schema: {
      type: 'object',
      properties: {
        remote: { type: 'string', description: 'Remoto git, por defecto origin.' },
        branch: { type: 'string', description: 'Rama a publicar; si se omite usa la rama actual.' },
      },
    },
  },
  {
    name: 'analyze_impact',
    description: 'Analiza qué archivos podrían verse afectados si modificás un módulo.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Archivo relativo a analizar.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'twin_query',
    description: 'Consulta el gemelo digital del proyecto (grafo de dependencias en .editcore/graph.json).',
    input_schema: {
      type: 'object',
      properties: {
        module: { type: 'string', description: 'Ruta del módulo, ej: src/agent/tools.ts' },
      },
      required: ['module'],
    },
  },
  {
    name: 'call_mcp',
    description: 'Invoca una herramienta de un servidor MCP configurado en .editcore/mcp.json',
    input_schema: {
      type: 'object',
      properties: {
        server: { type: 'string' },
        tool: { type: 'string' },
        arguments: { type: 'object' },
      },
      required: ['server', 'tool'],
    },
  },
  {
    name: 'write_adr',
    description:
      'Crea o actualiza un Architecture Decision Record en .editcore/adrs/. Requiere aprobación.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título corto del ADR (slug-friendly).' },
        context: { type: 'string' },
        decision: { type: 'string' },
        consequences: { type: 'string' },
      },
      required: ['title', 'context', 'decision'],
    },
  },
  {
    name: 'append_memory',
    description: 'Agrega una nota persistente a .editcore/memory.md para futuras sesiones del agente.',
    input_schema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'Nota concisa para recordar en el proyecto.' },
      },
      required: ['note'],
    },
  },
  {
    name: 'search_codebase',
    description:
      'Búsqueda híbrida (keywords + similitud semántica local) en el codebase indexado. Mejor que search_files para preguntas conceptuales.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Pregunta o concepto a buscar.' },
        limit: { type: 'number', description: 'Máximo resultados (default 8).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_adrs',
    description: 'Lista Architecture Decision Records en .editcore/adrs/.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'run_self_diagnostic',
    description:
      'Ejecuta autodiagnóstico de EditCore (plataforma + workspace): checks locales y opcionalmente análisis Claude.',
    input_schema: {
      type: 'object',
      properties: {
        include_claude_analysis: {
          type: 'boolean',
          description: 'Si true (default), analiza con Claude Haiku cuando hay API Key.',
        },
      },
    },
  },
] as const;

export type BuiltinToolName = (typeof AGENT_TOOLS)[number]['name'];
export type AgentToolName = BuiltinToolName | string;

export async function getAllAgentTools(allowedTools?: string[]): Promise<AnthropicTool[]> {
  const builtin: AnthropicTool[] = AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Record<string, unknown>,
  }));
  try {
    const mcp = await McpManager.getInstance().getTools();
    for (const t of mcp) {
      builtin.push({
        name: `mcp_${t.server}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
        description: `[MCP:${t.server}] ${t.description ?? t.name}`,
        input_schema: (t.inputSchema as Record<string, unknown>) ?? {
          type: 'object',
          properties: { arguments: { type: 'object' } },
        },
      });
    }
  } catch {
    // MCP opcional
  }
  if (!allowedTools || allowedTools.length === 0) {
    return builtin;
  }
  const allowedSet = new Set(allowedTools);
  return builtin.filter((t) => allowedSet.has(t.name));
}

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', 'build', '.editcore']);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function getWorkspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error('No hay ningún workspace abierto en VS Code.');
  }
  return folders[0].uri.fsPath;
}

export function resolveSafePath(relativePath: string): string {
  const root = getWorkspaceRoot();
  const resolved = path.normalize(path.join(root, relativePath));
  if (!resolved.startsWith(path.normalize(root))) {
    throw new Error(`Ruta fuera del workspace bloqueada: ${relativePath}`);
  }
  return resolved;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n...[truncado, ${text.length - max} caracteres más]`;
}

async function walkFiles(
  root: string,
  dir: string,
  onFile: (rel: string, abs: string) => void | Promise<void>
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      continue;
    }
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await walkFiles(root, abs, onFile);
    } else {
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      await onFile(rel, abs);
    }
  }
}

function globMatch(pattern: string, relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  const p = pattern.replace(/\\/g, '/');
  if (p.includes('**')) {
    const escaped = p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(norm);
  }
  if (p.includes('*')) {
    const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp(`^${escaped}$`, 'i').test(norm);
  }
  return norm === p || norm.endsWith('/' + p);
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function execListDirectory(input: { path: string }): Promise<string> {
  const abs = resolveSafePath(input.path);
  const entries = await fs.promises.readdir(abs, { withFileTypes: true });
  const lines = entries
    .filter((e) => !SKIP_DIRS.has(e.name))
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort();
  return lines.length > 0 ? lines.join('\n') : '(carpeta vacía)';
}

async function execReadFile(input: { path: string; offset?: number; limit?: number }): Promise<string> {
  const abs = resolveSafePath(input.path);
  if (!(await isReadableFile(abs))) {
    const hint = (await fs.promises.stat(abs).catch(() => undefined))?.isDirectory()
      ? " Es una carpeta — usa list_directory o glob_files."
      : "";
    throw new Error(`No es un archivo legible: ${input.path}.${hint}`);
  }
  const content = await fs.promises.readFile(abs, 'utf-8');
  const lines = content.split('\n');
  const start = Math.max(0, (input.offset ?? 1) - 1);
  const end = input.limit ? start + input.limit : lines.length;
  const slice = lines.slice(start, end);
  return slice
    .map((line, i) => `${String(start + i + 1).padStart(4, ' ')}\t${line}`)
    .join('\n');
}

async function execSearchFiles(input: {
  pattern: string;
  path?: string;
  max_results?: number;
}): Promise<string> {
  const root = getWorkspaceRoot();
  const base = input.path ? resolveSafePath(input.path) : root;
  const max = input.max_results ?? 40;
  let regex: RegExp;
  try {
    regex = new RegExp(input.pattern, 'i');
  } catch (e: any) {
    throw new Error(`Regex inválido: ${e.message}`);
  }

  const hits: string[] = [];
  await walkFiles(root, base, async (rel, abs) => {
    if (hits.length >= max) {
      return;
    }
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(abs);
      if (!stat.isFile() || stat.size > 300_000) {
        return;
      }
    } catch {
      return;
    }
    let content: string;
    try {
      content = await fs.promises.readFile(abs, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length && hits.length < max; i++) {
      if (regex.test(lines[i])) {
        hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
      }
    }
  });

  return hits.length > 0 ? hits.join('\n') : '(sin coincidencias)';
}

async function execGlobFiles(input: { pattern: string; max_results?: number }): Promise<string> {
  const root = getWorkspaceRoot();
  const max = input.max_results ?? 80;
  const matches: string[] = [];
  await walkFiles(root, root, async (rel) => {
    if (matches.length >= max) {
      return;
    }
    if (globMatch(input.pattern, rel)) {
      matches.push(rel);
    }
  });
  matches.sort();
  return matches.length > 0 ? matches.join('\n') : '(sin archivos)';
}

async function execWriteFile(input: { path: string; content: string }): Promise<string> {
  const abs = resolveSafePath(input.path);
  const fileExists = fs.existsSync(abs);
  const impact = fileExists ? await analyzeFileImpact(input.path) : undefined;
  const approved = await showDiffAndConfirm(abs, input.content, fileExists, impact);
  if (!approved) {
    return 'RECHAZADO_POR_EL_USUARIO: el usuario no aprobó este cambio.';
  }
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, input.content, 'utf-8');
  return `OK: archivo ${fileExists ? 'actualizado' : 'creado'} en ${input.path}`;
}

async function execApplyPatch(input: {
  path: string;
  old_string: string;
  new_string: string;
}): Promise<string> {
  const abs = resolveSafePath(input.path);
  if (!fs.existsSync(abs)) {
    throw new Error(`Archivo no existe: ${input.path}`);
  }
  const original = await fs.promises.readFile(abs, 'utf8');
  const usesCrlf = original.includes('\r\n');

  let oldString = input.old_string;
  let newString = input.new_string;
  let count = original.split(oldString).length - 1;

  if (count === 0 && usesCrlf && !oldString.includes('\r\n') && oldString.includes('\n')) {
    const crlfOld = oldString.replace(/\n/g, '\r\n');
    const crlfCount = original.split(crlfOld).length - 1;
    if (crlfCount > 0) {
      oldString = crlfOld;
      newString = newString.replace(/\n/g, '\r\n');
      count = crlfCount;
    }
  }

  if (count === 0) {
    throw new Error(
      'old_string no encontrado en el archivo. Probablemente no coincide exactamente (espacios, indentación o ' +
        'saltos de línea distintos). Usá read_file para releer el contenido actual y copiá old_string textual ' +
        'desde ahí antes de reintentar.'
    );
  }
  if (count > 1) {
    throw new Error('old_string no es único — proporciona más contexto.');
  }
  const updated = original.replace(oldString, newString);
  const impact = await analyzeFileImpact(input.path);
  const approved = await showDiffAndConfirm(abs, updated, true, impact);
  if (!approved) {
    return 'RECHAZADO_POR_EL_USUARIO: el usuario no aprobó este parche.';
  }
  await fs.promises.writeFile(abs, updated, 'utf-8');
  return `OK: parche aplicado en ${input.path}`;
}

async function execRunCommand(input: { command: string; reason?: string }): Promise<string> {
  const decision = await requestCommandApproval(input.command, input.reason);
  if (decision.action === 'cancel') {
    return 'RECHAZADO_POR_EL_USUARIO: comando cancelado.';
  }
  const finalCommand = decision.action === 'edit' ? decision.editedCommand! : input.command;
  return execInWorkspace(finalCommand);
}

async function execGitStatus(): Promise<string> {
  return execInWorkspace('git status --short');
}

async function execGitDiff(input: { path?: string; staged?: boolean }): Promise<string> {
  const parts = ['git', 'diff'];
  if (input.staged) {
    parts.push('--cached');
  }
  if (input.path) {
    parts.push('--', input.path);
  }
  return execInWorkspace(parts.join(' '));
}

async function execGitCommit(input: { message: string }): Promise<string> {
  const cmd = `git commit -m ${JSON.stringify(input.message)}`;
  const decision = await requestCommandApproval(cmd, 'Crear commit git');
  if (decision.action === 'cancel') {
    return 'RECHAZADO_POR_EL_USUARIO: commit cancelado.';
  }
  const finalCommand = decision.action === 'edit' ? decision.editedCommand! : cmd;
  return execInWorkspace(finalCommand);
}

async function execGitPush(input: { remote?: string; branch?: string }): Promise<string> {
  const remote = input.remote?.trim() || 'origin';
  const branch = input.branch?.trim();
  const cmd = branch ? `git push ${remote} ${branch}` : `git push ${remote}`;
  const decision = await requestCommandApproval(cmd, 'Publicar cambios (git push)');
  if (decision.action === 'cancel') {
    return 'RECHAZADO_POR_EL_USUARIO: push cancelado.';
  }
  const finalCommand = decision.action === 'edit' ? decision.editedCommand! : cmd;
  return execInWorkspace(finalCommand);
}

function execInWorkspace(command: string): Promise<string> {
  const root = getWorkspaceRoot();
  return new Promise((resolve) => {
    exec(command, { cwd: root, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      const out = truncate(stdout, 6000);
      const err = truncate(stderr, 3000);
      if (error) {
        resolve(`EXIT_CODE: ${error.code ?? 'desconocido'}\nSTDOUT:\n${out}\nSTDERR:\n${err}`);
      } else {
        resolve(`EXIT_CODE: 0\nSTDOUT:\n${out}${err ? `\nSTDERR:\n${err}` : ''}`);
      }
    });
  });
}

async function showDiffAndConfirm(
  absPath: string,
  newContent: string,
  fileExists: boolean,
  impact?: Awaited<ReturnType<typeof analyzeFileImpact>>
): Promise<boolean> {
  const tmpPath = path.join(os.tmpdir(), `editcore-agent-${Date.now()}-${path.basename(absPath)}`);
  await fs.promises.writeFile(tmpPath, newContent, 'utf-8');
  const tmpUri = vscode.Uri.file(tmpPath);
  const relativeLabel = vscode.workspace.asRelativePath(absPath);

  if (fileExists) {
    await vscode.commands.executeCommand(
      'vscode.diff',
      vscode.Uri.file(absPath),
      tmpUri,
      `Agent: cambios en ${relativeLabel}`
    );
  } else {
    const doc = await vscode.workspace.openTextDocument(tmpUri);
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  const impactLine = impact ? `\n\nImpacto: ${impact.summary}` : '';
  const choice = await vscode.window.showInformationMessage(
    `Claude quiere ${fileExists ? 'modificar' : 'crear'} "${relativeLabel}".${impactLine}`,
    { modal: true, detail: impact ? formatImpactReport(impact) : undefined },
    'Aplicar',
    'Cancelar'
  );
  fs.promises.unlink(tmpPath).catch(() => {});
  const approved = choice === 'Aplicar';
  const { appendAudit } = await import('../enterprise/orgConfig');
  await appendAudit({
    type: 'decision',
    kind: 'file_write',
    action: approved ? 'apply' : 'cancel',
    path: relativeLabel,
  });
  return approved;
}

async function execWriteAdr(input: {
  title: string;
  context: string;
  decision: string;
  consequences?: string;
}): Promise<string> {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const rel = `.editcore/adrs/${slug}.md`;
  const body = `# ADR: ${input.title}

## Contexto
${input.context}

## Decisión
${input.decision}

## Consecuencias
${input.consequences ?? '_Por documentar._'}

---
_Generado por EditCore Agent — ${new Date().toISOString()}_
`;
  return execWriteFile({ path: rel, content: body });
}

async function execAppendMemory(input: { note: string }): Promise<string> {
  const root = getWorkspaceRoot();
  const memPath = path.join(root, '.editcore', 'memory.md');
  await fs.promises.mkdir(path.dirname(memPath), { recursive: true });
  const line = `\n- ${new Date().toISOString().slice(0, 10)}: ${input.note.trim()}\n`;
  let exists = false;
  try {
    await fs.promises.access(memPath);
    exists = true;
  } catch {
    // nuevo
  }
  if (!exists) {
    await fs.promises.writeFile(memPath, '# Memoria del proyecto\n', 'utf8');
  }
  await fs.promises.appendFile(memPath, line, 'utf8');
  return `Memoria actualizada en .editcore/memory.md`;
}

async function execListAdrs(): Promise<string> {
  const root = getWorkspaceRoot();
  const dir = path.join(root, '.editcore', 'adrs');
  try {
    const files = await fs.promises.readdir(dir);
    const md = files.filter((f) => f.endsWith('.md')).sort();
    if (md.length === 0) {
      return 'Sin ADRs en .editcore/adrs/. Usá write_adr para crear uno.';
    }
    const lines: string[] = [];
    for (const f of md) {
      const filePath = path.join(dir, f);
      if (!(await isReadableFile(filePath))) {
        continue;
      }
      const content = await fs.promises.readFile(filePath, 'utf8');
      const title = content.match(/^# ADR:\s*(.+)$/m)?.[1] ?? f;
      lines.push(`- ${f}: ${title}`);
    }
    return lines.join('\n');
  } catch {
    return 'Carpeta .editcore/adrs/ no existe aún.';
  }
}

export async function executeAgentTool(
  name: string,
  input: any
): Promise<{ output: string; isError: boolean }> {
  toolCallRecorder?.(name);
  try {
    if (name.startsWith('mcp_')) {
      return await executeMcpToolByName(name, input);
    }
    let output: string;
    switch (name as BuiltinToolName) {
      case 'list_directory':
        output = await execListDirectory(input);
        break;
      case 'read_file':
        output = await execReadFile(input);
        break;
      case 'search_files':
        output = await execSearchFiles(input);
        break;
      case 'glob_files':
        output = await execGlobFiles(input);
        break;
      case 'write_file':
        output = await execWriteFile(input);
        break;
      case 'apply_patch':
        output = await execApplyPatch(input);
        break;
      case 'run_command':
        output = await execRunCommand(input);
        break;
      case 'git_status':
        output = await execGitStatus();
        break;
      case 'git_diff':
        output = await execGitDiff(input ?? {});
        break;
      case 'git_commit':
        output = await execGitCommit(input);
        break;
      case 'git_push':
        output = await execGitPush(input ?? {});
        break;
      case 'analyze_impact': {
        const report = await analyzeFileImpact(input.path);
        output = formatImpactReport(report);
        break;
      }
      case 'search_codebase': {
        const { hybridCodeSearch } = await import('../rag/chunkIndex');
        const { keyword, rag } = await hybridCodeSearch(input.query, input.limit ?? 8);
        output = [keyword, rag].filter(Boolean).join('\n\n') || 'Sin resultados en el índice.';
        break;
      }
      case 'twin_query': {
        const graph = await loadDependencyGraph();
        output = graph
          ? formatGraphAnswer(graph, input.module)
          : 'Gemelo digital no generado. Ejecutá "EditCore: Actualizar gemelo digital".';
        break;
      }
      case 'call_mcp': {
        const res = await McpManager.getInstance().callTool(
          input.server,
          input.tool,
          input.arguments ?? {}
        );
        return { output: res.content, isError: res.isError };
      }
      case 'write_adr':
        output = await execWriteAdr(input);
        break;
      case 'append_memory':
        output = await execAppendMemory(input);
        break;
      case 'list_adrs':
        output = await execListAdrs();
        break;
      case 'run_self_diagnostic': {
        const { runSelfDiagnostic } = await import('../diagnostics/diagnosticService');
        const { reportToMarkdown } = await import('../diagnostics/diagnosticTypes');
        const { getDiagnosticRuntime } = await import('../diagnostics/diagnosticRuntime');
        const rt = getDiagnosticRuntime();
        if (!rt) {
          output = 'Autodiagnóstico no disponible.';
          break;
        }
        const report = await runSelfDiagnostic(rt.context, rt.apiKeyService, {
          useClaude: input?.include_claude_analysis !== false,
          showPanel: false,
          showNotification: false,
        });
        output = reportToMarkdown(report);
        break;
      }
      default:
        return { output: `Tool desconocida: ${name}`, isError: true };
    }
    return { output, isError: false };
  } catch (err: any) {
    return { output: `ERROR: ${err.message ?? String(err)}`, isError: true };
  }
}

async function executeMcpToolByName(
  syntheticName: string,
  input: any
): Promise<{ output: string; isError: boolean }> {
  const tools = await McpManager.getInstance().getTools();
  const match = tools.find(
    (t) => syntheticName === `mcp_${t.server}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64)
  );
  if (!match) {
    return { output: `Tool MCP no encontrada: ${syntheticName}`, isError: true };
  }
  const res = await McpManager.getInstance().callTool(
    match.server,
    match.name,
    input?.arguments ?? input ?? {}
  );
  return { output: res.content, isError: res.isError };
}
