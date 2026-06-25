import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface GraphNode {
  id: string;
  imports: string[];
}

export interface DependencyGraph {
  generatedAt: string;
  nodes: GraphNode[];
}

const SKIP = new Set(['node_modules', '.git', 'out', 'dist', 'build']);

export async function buildDependencyGraph(): Promise<DependencyGraph> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return { generatedAt: new Date().toISOString(), nodes: [] };
  }

  const nodes: GraphNode[] = [];
  await walk(root, root, async (rel, abs) => {
    const content = await fs.promises.readFile(abs, 'utf8');
    const imports = extractImports(content, rel);
    nodes.push({ id: rel.replace(/\\/g, '/'), imports });
  });

  const graph = { generatedAt: new Date().toISOString(), nodes };
  await saveGraph(root, graph);
  return graph;
}

export async function loadDependencyGraph(): Promise<DependencyGraph | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  const p = path.join(root, '.editcore', 'graph.json');
  try {
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw) as DependencyGraph;
  } catch {
    return undefined;
  }
}

export function queryDependents(graph: DependencyGraph, moduleId: string): string[] {
  const norm = moduleId.replace(/\\/g, '/');
  const base = path.basename(norm);
  return graph.nodes
    .filter((n) => n.imports.some((i) => i.includes(norm) || i.includes(base)))
    .map((n) => n.id)
    .slice(0, 30);
}

export function formatGraphAnswer(graph: DependencyGraph, moduleId: string): string {
  const deps = queryDependents(graph, moduleId);
  if (deps.length === 0) {
    return `Ningún módulo indexado importa directamente a ${moduleId}.`;
  }
  return `Módulos que importan o referencian ${moduleId}:\n${deps.map((d) => `- ${d}`).join('\n')}`;
}

function extractImports(content: string, relPath: string): string[] {
  const found: string[] = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s+['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      found.push(m[1]);
    }
  }
  return [...new Set(found)];
}

async function saveGraph(root: string, graph: DependencyGraph): Promise<void> {
  const dir = path.join(root, '.editcore');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8');
}

async function walk(
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
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.github') {
      continue;
    }
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) {
        continue;
      }
      await walk(root, abs, onFile);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      await onFile(path.relative(root, abs), abs);
    }
  }
}
