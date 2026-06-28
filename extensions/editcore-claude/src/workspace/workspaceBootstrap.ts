import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { initOrgConfig } from '../enterprise/orgConfig';

const RULES_TEMPLATE = `# Reglas del proyecto — EditCore

Describe convenciones, stack, patrones y restricciones que el agente debe respetar.

## Stack
- 

## Convenciones
- 

## No hacer
- 
`;

export interface WorkspaceBootstrapResult {
  created: string[];
  skipped: string[];
}

export async function initWorkspace(): Promise<WorkspaceBootstrapResult> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error('Abre un workspace primero.');
  }

  const base = path.join(root, '.editcore');
  const created: string[] = [];
  const skipped: string[] = [];

  const dirs = [
    base,
    path.join(base, 'agents'),
    path.join(base, 'autonomy'),
    path.join(base, 'docs'),
    path.join(base, 'reports'),
    path.join(base, 'tech-memory'),
    path.join(base, 'memory'),
    path.join(base, 'marketplace', 'installed'),
    path.join(base, 'sessions'),
    path.join(base, 'templates'),
    path.join(base, 'adrs'),
    path.join(base, 'rag'),
    path.join(base, 'plans'),
    path.join(base, 'diagnostics'),
  ];
  for (const d of dirs) {
    await fs.promises.mkdir(d, { recursive: true });
  }

  const files: Array<{ rel: string; content: string | object }> = [
    { rel: 'rules.md', content: RULES_TEMPLATE },
    { rel: 'mcp.json', content: { servers: [] } },
    { rel: 'memory.md', content: '# Memoria del proyecto\n\nNotas persistentes para el agente.\n' },
    {
      rel: 'autonomy/README.md',
      content:
        '# Cola de autonomía EditCore\n\nGenerada por `editcore.autonomy.diagnose`.\n\n- `queue.json` — tareas pendientes\n- `cursor-prompts.md` — prompts para Cursor\n- `latest-report.md` — último diagnóstico\n',
    },
    {
      rel: 'docs/README.md',
      content:
        '# Documentación generada por EditCore\n\n- `EDITCORE_SYSTEM_MAP.md`\n- `REPORTE_CAMBIOS_EDITCORE.md`\n- `SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md`\n',
    },
  ];

  for (const f of files) {
    const dest = path.join(base, f.rel);
    try {
      await fs.promises.access(dest);
      skipped.push(f.rel);
    } catch {
      const body = typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2) + '\n';
      await fs.promises.writeFile(dest, body, 'utf8');
      created.push(f.rel);
    }
  }

  const orgPath = path.join(base, 'org.json');
  try {
    await fs.promises.access(orgPath);
    skipped.push('org.json');
  } catch {
    await initOrgConfig();
    created.push('org.json');
  }

  await appendAuditBootstrap(root);

  return { created, skipped };
}

async function appendAuditBootstrap(root: string): Promise<void> {
  const line =
    JSON.stringify({ ts: new Date().toISOString(), event: 'workspace_init' }) + '\n';
  try {
    await fs.promises.appendFile(path.join(root, '.editcore', 'audit.jsonl'), line, 'utf8');
  } catch {
    // opcional
  }
}

export async function showInitWorkspaceResult(): Promise<void> {
  const result = await initWorkspace();
  const msg =
    result.created.length > 0
      ? `EditCore: creado ${result.created.join(', ')} en .editcore/`
      : 'EditCore: .editcore/ ya estaba inicializado.';
  vscode.window.showInformationMessage(msg);
}
