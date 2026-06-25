/**
 * Cliente MCP mínimo (JSON-RPC stdio) para servidores configurados en .editcore/mcp.json
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as readline from 'readline';
import { McpServerConfig, McpToolDefinition, McpToolCallResult } from './mcpTypes';
import { loadMcpServers } from './mcpConfig';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  id?: number;
  result?: any;
  error?: { message?: string; code?: number };
}

class McpServerSession {
  private proc: ChildProcessWithoutNullStreams | undefined;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private tools: McpToolDefinition[] = [];
  private ready = false;

  constructor(readonly config: McpServerConfig) {}

  async connect(): Promise<void> {
    if (this.ready) {
      return;
    }
    this.proc = spawn(this.config.command, this.config.args ?? [], {
      cwd: this.config.cwd,
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => this.onLine(line));

    this.proc.stderr.on('data', () => {
      // stderr ignorado en v1
    });
    this.proc.on('exit', () => {
      this.ready = false;
      for (const [, p] of this.pending) {
        p.reject(new Error(`MCP server ${this.config.name} terminó inesperadamente.`));
      }
      this.pending.clear();
    });

    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'editcore-claude', version: '0.2.0' },
    });
    await this.notify('notifications/initialized', {});
    const listed = await this.request('tools/list', {});
    const tools = listed?.tools ?? [];
    this.tools = tools.map((t: any) => ({
      server: this.config.name,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    this.ready = true;
  }

  getTools(): McpToolDefinition[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    if (!this.ready) {
      await this.connect();
    }
    const result = await this.request('tools/call', { name, arguments: args });
    const blocks = result?.content ?? [];
    const text = blocks
      .map((b: any) => (b.type === 'text' ? b.text : JSON.stringify(b)))
      .join('\n');
    return { content: text || JSON.stringify(result), isError: Boolean(result?.isError) };
  }

  dispose(): void {
    this.proc?.kill();
    this.proc = undefined;
    this.ready = false;
  }

  private onLine(line: string): void {
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id === undefined) {
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) {
      return;
    }
    this.pending.delete(msg.id);
    if (msg.error) {
      p.reject(new Error(msg.error.message ?? 'MCP error'));
    } else {
      p.resolve(msg.result);
    }
  }

  private request(method: string, params?: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin.writable) {
        reject(new Error('MCP stdin no disponible'));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const payload: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      this.proc.stdin.write(JSON.stringify(payload) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  private notify(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.proc?.stdin.writable) {
      return Promise.resolve();
    }
    const payload = { jsonrpc: '2.0', method, params };
    this.proc.stdin.write(JSON.stringify(payload) + '\n');
    return Promise.resolve();
  }
}

export class McpManager {
  private static instance: McpManager | undefined;
  private sessions = new Map<string, McpServerSession>();
  private toolCache: McpToolDefinition[] = [];

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  async refresh(): Promise<McpToolDefinition[]> {
    this.dispose();
    const servers = await loadMcpServers();
    const all: McpToolDefinition[] = [];
    for (const cfg of servers) {
      try {
        const session = new McpServerSession(cfg);
        await session.connect();
        this.sessions.set(cfg.name, session);
        all.push(...session.getTools());
      } catch {
        // servidor opcional — no bloquear
      }
    }
    this.toolCache = all;
    return all;
  }

  async getTools(): Promise<McpToolDefinition[]> {
    if (this.toolCache.length === 0) {
      await this.refresh();
    }
    return this.toolCache;
  }

  async callTool(server: string, tool: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    let session = this.sessions.get(server);
    if (!session) {
      await this.refresh();
      session = this.sessions.get(server);
    }
    if (!session) {
      return { content: `Servidor MCP no conectado: ${server}`, isError: true };
    }
    return session.callTool(tool, args);
  }

  dispose(): void {
    for (const s of this.sessions.values()) {
      s.dispose();
    }
    this.sessions.clear();
    this.toolCache = [];
  }
}
