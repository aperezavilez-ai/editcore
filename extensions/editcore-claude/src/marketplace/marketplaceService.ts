import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { canInstallTier, mergeCatalogs, parseCatalogJson } from './catalogMerge';
import { getEffectivePlan } from '../enterprise/orgConfig';

export { canInstallTier } from './catalogMerge';
export interface MarketplaceItem {
  id: string;
  type: 'agent' | 'template' | 'mcp';
  name: string;
  description: string;
  author: string;
  tier: 'free' | 'pro' | 'team' | 'business' | 'enterprise';
  role?: string;
  vertical?: string;
  promptFile?: string;
  scaffoldDir?: string;
  mcpServer?: { name: string; command: string; args?: string[] };
}

export interface MarketplaceCatalog {
  version: number;
  items: MarketplaceItem[];
}

export class MarketplaceService {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async getCatalog(): Promise<MarketplaceCatalog> {
    const bundledPath = path.join(this.extensionUri.fsPath, 'marketplace', 'catalog.json');
    const raw = await fs.promises.readFile(bundledPath, 'utf8');
    const bundled = parseCatalogJson(raw);

    const remoteUrl = vscode.workspace
      .getConfiguration('editcore')
      .get<string>('marketplace.remoteUrl', '')
      .trim();
    if (!remoteUrl) {
      return bundled;
    }

    try {
      const remote = await this.fetchRemoteCatalog(remoteUrl);
      return mergeCatalogs(bundled, remote);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showWarningMessage(`Marketplace remoto no disponible: ${message}`);
      return bundled;
    }
  }

  async refreshRemoteCatalog(): Promise<MarketplaceCatalog> {
    return this.getCatalog();
  }

  private async fetchRemoteCatalog(url: string): Promise<MarketplaceCatalog> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      return parseCatalogJson(text);
    } finally {
      clearTimeout(timeout);
    }
  }
  async getInstalledIds(): Promise<Set<string>> {
    const dir = this.getInstalledDir();
    try {
      const files = await fs.promises.readdir(dir);
      return new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));
    } catch {
      return new Set();
    }
  }

  async install(item: MarketplaceItem): Promise<void> {
    const plan = await getEffectivePlan();
    if (!canInstallTier(plan, item.tier)) {      throw new Error(`Tu plan "${plan}" no incluye ítems tier "${item.tier}". Actualizá en Ajustes → editcore.plan`);
    }

    const dir = this.getInstalledDir();
    await fs.promises.mkdir(dir, { recursive: true });

    const manifest = {
      ...item,
      installedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(
      path.join(dir, `${item.id}.json`),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    if (item.type === 'agent' && item.promptFile) {
      const src = path.join(this.extensionUri.fsPath, 'marketplace', item.promptFile);
      const destDir = path.join(this.getWorkspaceEditcore(), 'agents');
      await fs.promises.mkdir(destDir, { recursive: true });
      const dest = path.join(destDir, `${item.id}.md`);
      await fs.promises.copyFile(src, dest);
    }

    if (item.type === 'template' && item.scaffoldDir) {
      const src = path.join(this.extensionUri.fsPath, 'marketplace', item.scaffoldDir);
      const dest = path.join(this.getWorkspaceEditcore(), 'templates', item.id);
      await copyDir(src, dest);
    }

    if (item.type === 'mcp' && item.mcpServer) {
      await this.mergeMcpConfig(item.mcpServer);
    }
  }

  async uninstall(itemId: string): Promise<void> {
    const p = path.join(this.getInstalledDir(), `${itemId}.json`);
    try {
      await fs.promises.unlink(p);
    } catch {
      // ya no existe
    }
  }

  private getInstalledDir(): string {
    return path.join(this.getWorkspaceEditcore(), 'marketplace', 'installed');
  }

  private getWorkspaceEditcore(): string {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      throw new Error('Abre un workspace para instalar del marketplace.');
    }
    return path.join(root, '.editcore');
  }

  private async mergeMcpConfig(server: { name: string; command: string; args?: string[] }): Promise<void> {
    const mcpPath = path.join(this.getWorkspaceEditcore(), 'mcp.json');
    let config: { servers: any[] } = { servers: [] };
    try {
      config = JSON.parse(await fs.promises.readFile(mcpPath, 'utf8'));
    } catch {
      // nuevo
    }
    if (!Array.isArray(config.servers)) {
      config.servers = [];
    }
    config.servers = config.servers.filter((s) => s.name !== server.name);
    config.servers.push(server);
    await fs.promises.mkdir(path.dirname(mcpPath), { recursive: true });
    await fs.promises.writeFile(mcpPath, JSON.stringify(config, null, 2), 'utf8');
  }
}

async function copyDir(src: string, dest: string): Promise<void> {  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.promises.copyFile(s, d);
    }
  }
}
