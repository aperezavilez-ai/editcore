import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { McpServerConfig } from './mcpTypes';

const DEFAULT_SERVERS: McpServerConfig[] = [];

export async function loadMcpServers(): Promise<McpServerConfig[]> {
  const fromSettings = vscode.workspace.getConfiguration('editcore.mcp').get<McpServerConfig[]>('servers', []);
  const fromFile = await loadMcpConfigFile();
  const merged = [...DEFAULT_SERVERS, ...fromFile, ...fromSettings];
  const seen = new Set<string>();
  return merged.filter((s) => {
    if (!s.name?.trim() || !s.command?.trim()) {
      return false;
    }
    if (seen.has(s.name)) {
      return false;
    }
    seen.add(s.name);
    return true;
  });
}

async function loadMcpConfigFile(): Promise<McpServerConfig[]> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return [];
  }
  const configPath = path.join(root, '.editcore', 'mcp.json');
  try {
    const raw = await fs.promises.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { servers?: McpServerConfig[] };
    return Array.isArray(parsed.servers) ? parsed.servers : [];
  } catch {
    return [];
  }
}
