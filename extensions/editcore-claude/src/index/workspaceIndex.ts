import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const INDEX_VERSION = 2;
const CACHE_FILE = '.editcore/index-cache.json';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  'build',
  '.editcore',
  'coverage',
  '.next',
  'scaffold',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss',
  '.html', '.yaml', '.yml', '.xml', '.ps1', '.sh', '.py', '.go',
  '.rs', '.java', '.cs', '.sql', '.vue', '.svelte',
]);

export interface IndexSearchResult {
  path: string;
  score: number;
  snippet: string;
}

interface IndexedFile {
  relPath: string;
  tokens: Set<string>;
  symbols: Set<string>;
  preview: string;
  mtimeMs: number;
}

interface CachePayload {
  version: number;
  root: string;
  files: Record<string, { mtimeMs: number; tokens: string[]; symbols: string[]; preview: string }>;
}

export class WorkspaceIndex {
  private files = new Map<string, IndexedFile>();
  private indexing: Promise<void> | undefined;
  private lastRoot = '';
  private docFreq = new Map<string, number>();

  async ensureIndexed(): Promise<void> {
    const root = this.getWorkspaceRoot();
    if (!root) return;

    if (this.lastRoot === root && this.files.size > 0) return;

    if (!this.indexing) {
      this.indexing = this.rebuild(root).finally(() => {
        this.indexing = undefined;
      });
    }
    await this.indexing;
  }

  async forceRebuild(): Promise<void> {
    const root = this.getWorkspaceRoot();
    if (!root) return;
    this.files.clear();
    this.lastRoot = '';
    const cachePath = path.join(root, CACHE_FILE);
    await fs.promises.unlink(cachePath).catch(() => {});
    await this.rebuild(root);
  }

  async updateFile(absPath: string): Promise<void> {
    const root = this.getWorkspaceRoot();
    if (!root || !absPath.startsWith(root)) return;

    const rel = path.relative(root, absPath).replace(/\\/g, '/');
    if (rel.startsWith('.editcore')) return;

    const ext = path.extname(absPath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      this.files.delete(rel);
      this.recomputeDocFreq();
      await this.persistCache(root);
      return;
    }

    await this.indexFile(root, absPath);
    this.recomputeDocFreq();
    await this.persistCache(root);
  }

  async search(query: string, limit = 8): Promise<IndexSearchResult[]> {
    await this.ensureIndexed();
    const terms = tokenize(query);
    if (terms.length === 0 || this.files.size === 0) return [];

    const totalDocs = this.files.size || 1;
    const ranked: IndexSearchResult[] = [];

    for (const file of this.files.values()) {
      let score = 0;
      for (const term of terms) {
        const df = this.docFreq.get(term) ?? 1;
        const idf = Math.log(1 + totalDocs / df);

        if (file.symbols.has(term)) score += 8 * idf;
        if (file.relPath.toLowerCase().includes(term)) score += 5 * idf;
        if (file.tokens.has(term)) score += 3 * idf;
        if (file.preview.toLowerCase().includes(term)) score += 1 * idf;
      }
      if (score > 0) {
        ranked.push({
          path: file.relPath,
          score: Math.round(score * 10) / 10,
          snippet: file.preview.slice(0, 280).replace(/\s+/g, ' ').trim(),
        });
      }
    }

    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit);
  }

  formatSearchContext(results: IndexSearchResult[]): string {
    if (results.length === 0) return '';
    const lines = results.map(
      (r, i) => `${i + 1}. ${r.path} (score ${r.score})\n   ${r.snippet}`
    );
    return `Fragmentos relevantes del codebase (índice EditCore v2):\n${lines.join('\n')}`;
  }

  private async rebuild(root: string): Promise<void> {
    const loaded = await this.loadCache(root);
    if (!loaded) {
      this.files.clear();
      await this.walk(root, root);
    }
    this.lastRoot = root;
    this.recomputeDocFreq();
    await this.persistCache(root);
  }

  private async loadCache(root: string): Promise<boolean> {
    const cachePath = path.join(root, CACHE_FILE);
    try {
      const raw = await fs.promises.readFile(cachePath, 'utf8');
      const data = JSON.parse(raw) as CachePayload;
      if (data.version !== INDEX_VERSION || data.root !== root) return false;

      this.files.clear();
      let stale = 0;
      for (const [relPath, entry] of Object.entries(data.files)) {
        const abs = path.join(root, relPath);
        try {
          const stat = await fs.promises.stat(abs);
          if (stat.mtimeMs !== entry.mtimeMs) {
            stale += 1;
            await this.indexFile(root, abs);
          } else {
            this.files.set(relPath, {
              relPath,
              tokens: new Set(entry.tokens),
              symbols: new Set(entry.symbols),
              preview: entry.preview,
              mtimeMs: entry.mtimeMs,
            });
          }
        } catch {
          stale += 1;
        }
      }
      if (stale > 0) {
        await this.walk(root, root);
      }
      return this.files.size > 0;
    } catch {
      return false;
    }
  }

  private async persistCache(root: string): Promise<void> {
    const payload: CachePayload = {
      version: INDEX_VERSION,
      root,
      files: {},
    };
    for (const [rel, f] of this.files) {
      payload.files[rel] = {
        mtimeMs: f.mtimeMs,
        tokens: [...f.tokens].slice(0, 200),
        symbols: [...f.symbols].slice(0, 80),
        preview: f.preview.slice(0, 1200),
      };
    }
    const dir = path.join(root, '.editcore');
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'index-cache.json'), JSON.stringify(payload), 'utf8');
  }

  private recomputeDocFreq(): void {
    this.docFreq.clear();
    for (const file of this.files.values()) {
      const terms = new Set([...file.tokens, ...file.symbols]);
      for (const t of terms) {
        this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
      }
    }
  }

  private async walk(root: string, dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await this.walk(root, abs);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      await this.indexFile(root, abs);
    }
  }

  private async indexFile(root: string, absPath: string): Promise<void> {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(absPath);
      if (stat.size > 512_000) return;
    } catch {
      return;
    }

    let content: string;
    try {
      content = await fs.promises.readFile(absPath, 'utf8');
    } catch {
      return;
    }

    const relPath = path.relative(root, absPath).replace(/\\/g, '/');
    const symbols = extractSymbols(content);
    this.files.set(relPath, {
      relPath,
      tokens: new Set([...tokenize(content), ...symbols.map((s) => s.toLowerCase())]),
      symbols: new Set(symbols.map((s) => s.toLowerCase())),
      preview: content.slice(0, 1200),
      mtimeMs: stat.mtimeMs,
    });
  }

  private getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}

export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9_]{3,}/g);
  if (!matches) return [];
  return [...new Set(matches)].slice(0, 200);
}

export function extractSymbols(content: string): string[] {
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g,
  ];
  const found = new Set<string>();
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      found.add(m[1]);
    }
  }
  return [...found].slice(0, 80);
}

let singleton: WorkspaceIndex | undefined;

export function getWorkspaceIndex(): WorkspaceIndex {
  if (!singleton) singleton = new WorkspaceIndex();
  return singleton;
}
