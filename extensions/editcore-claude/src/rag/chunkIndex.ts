import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  tokenizeForRag,
  buildTermVector,
  chunkText,
  serializeVector,
  deserializeVector,
  cosineSimilarity,
} from './textUtils';

const RAG_VERSION = 1;
const CACHE_PATH = '.editcore/rag/index.json';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'out', 'dist', 'build', '.editcore', 'coverage', '.next', 'scaffold',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.java', '.cs', '.sql',
]);

export interface RagChunk {
  id: string;
  path: string;
  startLine: number;
  text: string;
  vector: Record<string, number>;
}

export interface RagSearchResult {
  path: string;
  startLine: number;
  score: number;
  text: string;
}

interface RagCache {
  version: number;
  root: string;
  chunks: RagChunk[];
}

export class RagIndex {
  private chunks: RagChunk[] = [];
  private building: Promise<void> | undefined;
  private lastRoot = '';

  async ensureBuilt(): Promise<void> {
    const root = this.getRoot();
    if (!root) return;
    if (this.lastRoot === root && this.chunks.length > 0) return;
    if (!this.building) {
      this.building = this.rebuild(root).finally(() => {
        this.building = undefined;
      });
    }
    await this.building;
  }

  async forceRebuild(): Promise<void> {
    const root = this.getRoot();
    if (!root) return;
    this.chunks = [];
    this.lastRoot = '';
    await fs.promises.unlink(path.join(root, CACHE_PATH)).catch(() => {});
    await this.rebuild(root);
  }

  async updateFile(absPath: string): Promise<void> {
    const root = this.getRoot();
    if (!root || !absPath.startsWith(root)) return;
    const rel = path.relative(root, absPath).replace(/\\/g, '/');
    if (rel.startsWith('.editcore')) return;

    this.chunks = this.chunks.filter((c) => c.path !== rel);
    const ext = path.extname(absPath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      await this.persist(root);
      return;
    }

    try {
      const stat = await fs.promises.stat(absPath);
      if (stat.size > 512_000) return;
      const content = await fs.promises.readFile(absPath, 'utf8');
      this.chunks.push(...chunkFile(rel, content));
      await this.persist(root);
    } catch {
      // ignore
    }
  }

  async search(query: string, limit = 6): Promise<RagSearchResult[]> {
    await this.ensureBuilt();
    const qVec = buildTermVector(tokenizeForRag(query));
    if (qVec.size === 0 || this.chunks.length === 0) return [];

    const ranked: RagSearchResult[] = [];
    for (const chunk of this.chunks) {
      const cVec = deserializeVector(chunk.vector);
      const score = cosineSimilarity(qVec, cVec);
      if (score > 0.05) {
        ranked.push({
          path: chunk.path,
          startLine: chunk.startLine,
          score: Math.round(score * 1000) / 1000,
          text: chunk.text.slice(0, 400),
        });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    const localTop = ranked.slice(0, Math.max(limit * 3, 24));

    try {
      const { getVoyageApiKey, isEmbeddingsEnabled, embedQuery, embedTexts, cosineFloat } =
        await import('./voyageService');
      const voyageKey = await getVoyageApiKey();
      if (!voyageKey || !isEmbeddingsEnabled() || localTop.length === 0) {
        return localTop.slice(0, limit);
      }

      const qEmb = await embedQuery(query);
      const texts = localTop.map((r) => r.text);
      const docEmbs = await embedTexts(texts);
      const reranked = localTop.map((r, i) => ({
        ...r,
        score: Math.round(cosineFloat(qEmb, docEmbs[i]) * 1000) / 1000,
      }));
      reranked.sort((a, b) => b.score - a.score);
      return reranked.slice(0, limit);
    } catch {
      return localTop.slice(0, limit);
    }
  }

  formatSearchContext(results: RagSearchResult[]): string {
    if (results.length === 0) return '';
    const mode =
      vscode.workspace.getConfiguration('editcore').get<boolean>('rag.useEmbeddings', true)
        ? 'híbrido + Voyage (si hay key)'
        : 'local TF-IDF';
    const lines = results.map(
      (r, i) =>
        `${i + 1}. ${r.path}:${r.startLine} (sim ${r.score})\n   ${r.text.replace(/\s+/g, ' ').trim()}`
    );
    return `RAG (${mode}):\n${lines.join('\n')}`;
  }

  getStats(): { chunks: number; files: number } {
    const files = new Set(this.chunks.map((c) => c.path));
    return { chunks: this.chunks.length, files: files.size };
  }

  private async rebuild(root: string): Promise<void> {
    const loaded = await this.loadCache(root);
    if (!loaded) {
      this.chunks = [];
      await this.walk(root, root);
      await this.persist(root);
    }
    this.lastRoot = root;
  }

  private async loadCache(root: string): Promise<boolean> {
    try {
      const raw = await fs.promises.readFile(path.join(root, CACHE_PATH), 'utf8');
      const data = JSON.parse(raw) as RagCache;
      if (data.version !== RAG_VERSION || data.root !== root) return false;
      this.chunks = data.chunks;
      return this.chunks.length > 0;
    } catch {
      return false;
    }
  }

  private async persist(root: string): Promise<void> {
    const dir = path.join(root, '.editcore', 'rag');
    await fs.promises.mkdir(dir, { recursive: true });
    const payload: RagCache = { version: RAG_VERSION, root, chunks: this.chunks };
    await fs.promises.writeFile(path.join(dir, 'index.json'), JSON.stringify(payload), 'utf8');
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
      try {
        const stat = await fs.promises.stat(abs);
        if (!stat.isFile() || stat.size > 512_000) continue;
        const content = await fs.promises.readFile(abs, 'utf8');
        const rel = path.relative(root, abs).replace(/\\/g, '/');
        this.chunks.push(...chunkFile(rel, content));
      } catch {
        // skip
      }
    }
  }

  private getRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}

function chunkFile(relPath: string, content: string): RagChunk[] {
  const parts = chunkText(content);
  return parts.map((p, idx) => {
    const tokens = tokenizeForRag(p.text);
    return {
      id: `${relPath}#${p.startLine}#${idx}`,
      path: relPath,
      startLine: p.startLine,
      text: p.text,
      vector: serializeVector(buildTermVector(tokens)),
    };
  });
}

let singleton: RagIndex | undefined;

export function getRagIndex(): RagIndex {
  if (!singleton) singleton = new RagIndex();
  return singleton;
}

export async function hybridCodeSearch(
  query: string,
  limit = 8
): Promise<{ keyword: string; rag: string }> {
  const { getWorkspaceIndex } = await import('../index/workspaceIndex');
  const index = getWorkspaceIndex();
  const rag = getRagIndex();

  const [kwResults, ragResults] = await Promise.all([
    index.search(query, limit),
    rag.search(query, Math.ceil(limit / 2)),
  ]);

  return {
    keyword: index.formatSearchContext(kwResults),
    rag: rag.formatSearchContext(ragResults),
  };
}
