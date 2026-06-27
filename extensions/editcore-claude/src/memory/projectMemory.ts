import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const MEMORY_FILES = [
  '.editcore/rules.md',
  '.editcore/memory.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.github/copilot-instructions.md',
] as const;

async function loadInstalledAgentPrompts(root: string): Promise<MemorySection[]> {
  const agentsDir = path.join(root, '.editcore', 'agents');
  const sections: MemorySection[] = [];
  try {
    const files = await fs.promises.readdir(agentsDir);
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      const content = (await fs.promises.readFile(path.join(agentsDir, f), 'utf8')).trim();
      if (content) {
        sections.push({ source: `.editcore/agents/${f}`, content: content.slice(0, 12_000) });
      }
    }
  } catch {
    // opcional
  }
  return sections;
}

export interface MemorySection {
  source: string;
  content: string;
}

export async function loadProjectMemory(): Promise<MemorySection[]> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return [];
  }

  const sections: MemorySection[] = [];
  for (const rel of MEMORY_FILES) {
    const abs = path.join(root, rel);
    try {
      const stat = await fs.promises.stat(abs);
      if (!stat.isFile()) {
        continue;
      }
      const content = await fs.promises.readFile(abs, 'utf8');
      const trimmed = content.trim();
      if (trimmed) {
        sections.push({ source: rel, content: trimmed.slice(0, 12_000) });
      }
    } catch {
      // archivo opcional
    }
  }

  const agentPrompts = await loadInstalledAgentPrompts(root);
  sections.push(...agentPrompts);

  return sections;
}

export function formatMemoryForPrompt(sections: MemorySection[]): string {
  if (sections.length === 0) {
    return '';
  }
  const blocks = sections.map(
    (s) => `### ${s.source}\n${s.content}`
  );
  return `Memoria y reglas del proyecto (respétalas):\n\n${blocks.join('\n\n')}`;
}
