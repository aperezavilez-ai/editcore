import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot, resolveSafePath } from './tools';

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', 'build']);

export interface ImpactReport {
  targetPath: string;
  importers: string[];
  referenceCount: number;
  risk: 'low' | 'medium' | 'high';
  summary: string;
}

export async function analyzeFileImpact(relativePath: string): Promise<ImpactReport> {
  const root = getWorkspaceRoot();
  const targetAbs = resolveSafePath(relativePath);
  const targetBase = path.basename(relativePath).replace(/\.[^.]+$/, '');
  const targetNoExt = relativePath.replace(/\\/g, '/');

  const importers: string[] = [];
  await walk(root, root, async (rel, abs) => {
    if (rel.replace(/\\/g, '/') === targetNoExt) {
      return;
    }
    let content: string;
    try {
      const stat = await fs.promises.stat(abs);
      if (stat.size > 400_000) {
        return;
      }
      content = await fs.promises.readFile(abs, 'utf8');
    } catch {
      return;
    }
    if (
      content.includes(targetNoExt) ||
      content.includes(targetBase) ||
      content.includes(path.basename(relativePath))
    ) {
      importers.push(rel.replace(/\\/g, '/'));
    }
  });

  const unique = [...new Set(importers)].slice(0, 25);
  const count = unique.length;
  const risk: ImpactReport['risk'] = count > 15 ? 'high' : count > 5 ? 'medium' : 'low';

  return {
    targetPath: relativePath,
    importers: unique,
    referenceCount: count,
    risk,
    summary:
      count === 0
        ? `Sin referencias detectadas a ${relativePath} (impacto bajo).`
        : `${count} archivo(s) posiblemente afectado(s). Riesgo: ${risk}.`,
  };
}

export function formatImpactReport(report: ImpactReport): string {
  const lines = [report.summary];
  if (report.importers.length > 0) {
    lines.push('Archivos que referencian o importan el objetivo:');
    for (const f of report.importers) {
      lines.push(`- ${f}`);
    }
  }
  return lines.join('\n');
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
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      continue;
    }
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await walk(root, abs, onFile);
    } else if (/\.(ts|tsx|js|jsx|json|md|py|go|rs)$/.test(entry.name)) {
      const rel = path.relative(root, abs);
      await onFile(rel, abs);
    }
  }
}
