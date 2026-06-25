import * as fs from 'fs';
import * as path from 'path';

export interface ScaffoldCopyResult {
  copied: string[];
  skipped: string[];
}

export async function copyScaffoldTree(
  srcDir: string,
  destDir: string,
  options?: { overwrite?: boolean }
): Promise<ScaffoldCopyResult> {
  const overwrite = options?.overwrite ?? false;
  const copied: string[] = [];
  const skipped: string[] = [];

  await fs.promises.mkdir(destDir, { recursive: true });

  async function walk(rel: string): Promise<void> {
    const abs = path.join(srcDir, rel);
    const stat = await fs.promises.stat(abs);
    const dest = path.join(destDir, rel);

    if (stat.isDirectory()) {
      await fs.promises.mkdir(dest, { recursive: true });
      const entries = await fs.promises.readdir(abs);
      for (const name of entries) {
        await walk(path.join(rel, name));
      }
      return;
    }

    try {
      await fs.promises.access(dest);
      if (!overwrite) {
        skipped.push(rel.replace(/\\/g, '/'));
        return;
      }
    } catch {
      // no existe
    }

    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(abs, dest);
    copied.push(rel.replace(/\\/g, '/'));
  }

  const top = await fs.promises.readdir(srcDir);
  for (const name of top) {
    await walk(name);
  }

  return { copied, skipped };
}

export function listScaffoldFiles(srcDir: string): string[] {
  const files: string[] = [];
  function walk(dir: string, prefix: string): void {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${name.name}` : name.name;
      const abs = path.join(dir, name.name);
      if (name.isDirectory()) {
        walk(abs, rel);
      } else {
        files.push(rel);
      }
    }
  }
  walk(srcDir, '');
  return files;
}
