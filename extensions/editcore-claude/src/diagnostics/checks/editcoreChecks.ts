import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ApiKeyService } from '../../apiKeyService';
import { getRagIndex } from '../../rag/chunkIndex';
import { getWorkspaceIndex } from '../../index/workspaceIndex';
import { McpManager } from '../../mcp/mcpClient';
import { loadMcpServers } from '../../mcp/mcpConfig';
import { DiagnosticFinding } from '../diagnosticTypes';

export async function runEditcoreChecks(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<DiagnosticFinding[]> {
  const findings: DiagnosticFinding[] = [];
  const version = String(context.extension.packageJSON.version ?? '?');

  findings.push({
    id: 'ext.version',
    category: 'editcore',
    severity: 'ok',
    title: 'Extensión EditCore Claude',
    message: `v${version} activa.`,
  });

  const hasAnthropic = await apiKeyService.hasApiKey();
  const hasOpenAi = await apiKeyService.hasOpenAiKey();
  findings.push({
    id: 'api.key',
    category: 'editcore',
    severity: hasAnthropic ? 'ok' : hasOpenAi ? 'warning' : 'critical',
    title: 'API Key Anthropic (Claude)',
    message: hasAnthropic
      ? 'API Key configurada en SecretStorage.'
      : hasOpenAi
        ? 'Sin key Anthropic — el chat usará OpenAI como proveedor principal.'
        : 'No hay API Key. El chat y el agente no funcionarán.',
    hint: hasAnthropic ? undefined : 'EditCore -> Cuenta & API -> pegar key GPTPRO4ALL sk-...',
  });

  findings.push({
    id: 'api.openai',
    category: 'editcore',
    severity: hasOpenAi ? 'ok' : 'info',
    title: 'API Key OpenAI (respaldo)',
    message: hasOpenAi
      ? 'OpenAI configurada — respaldo automático disponible.'
      : 'Sin key OpenAI — solo Claude (si está configurado).',
    hint: hasOpenAi ? undefined : 'Opcional: platform.openai.com/api-keys',
  });

  const fallbackEnabled = vscode.workspace.getConfiguration('editcore').get<boolean>('fallback.enabled', true);
  findings.push({
    id: 'api.fallback',
    category: 'editcore',
    severity: fallbackEnabled && hasOpenAi ? 'ok' : 'info',
    title: 'Respaldo OpenAI',
    message: fallbackEnabled
      ? hasOpenAi
        ? 'Activo: si Claude falla, se usa OpenAI.'
        : 'Activo pero sin key OpenAI configurada.'
      : 'Desactivado en configuración.',
  });

  const model = vscode.workspace.getConfiguration('editcore').get<string>('model', 'claude-sonnet-4-6');
  findings.push({
    id: 'api.model',
    category: 'editcore',
    severity: 'info',
    title: 'Modelo Claude',
    message: `Modelo actual: ${model}`,
  });

  const rag = getRagIndex().getStats();
  findings.push({
    id: 'rag.index',
    category: 'editcore',
    severity: rag.chunks > 0 ? 'ok' : 'warning',
    title: 'Índice RAG',
    message:
      rag.chunks > 0
        ? `${rag.chunks} chunks en ${rag.files} archivos.`
        : 'Índice RAG vacío o no construido.',
    hint: rag.chunks > 0 ? undefined : 'Ejecutá "EditCore: Construir índice RAG".',
  });

  try {
    await getWorkspaceIndex().ensureIndexed();
    findings.push({
      id: 'index.keyword',
      category: 'editcore',
      severity: 'ok',
      title: 'Índice keyword',
      message: 'Índice keyword del workspace disponible.',
    });
  } catch (err) {
    findings.push({
      id: 'index.keyword',
      category: 'editcore',
      severity: 'warning',
      title: 'Índice keyword',
      message: err instanceof Error ? err.message : String(err),
      hint: 'EditCore: Reindexar workspace.',
    });
  }

  const mcpConfigs = await loadMcpServers();
  if (mcpConfigs.length === 0) {
    findings.push({
      id: 'mcp.config',
      category: 'editcore',
      severity: 'info',
      title: 'Servidores MCP',
      message: 'Sin servidores en .editcore/mcp.json ni en settings.',
      hint: 'Opcional: agregá MCP para herramientas externas.',
    });
  } else {
    let connected = 0;
    try {
      const tools = await McpManager.getInstance().getTools();
      connected = tools.length > 0 ? mcpConfigs.length : 0;
    } catch {
      connected = 0;
    }
    findings.push({
      id: 'mcp.config',
      category: 'editcore',
      severity: connected > 0 ? 'ok' : 'warning',
      title: 'Servidores MCP',
      message: `${mcpConfigs.length} configurado(s), ${connected > 0 ? 'con herramientas activas' : 'sin conexión activa'}.`,
      hint: connected > 0 ? undefined : 'EditCore: Reconectar servidores MCP.',
    });
  }

  const voyageKey = await context.secrets.get('voyageApiKey');
  findings.push({
    id: 'rag.voyage',
    category: 'editcore',
    severity: voyageKey ? 'ok' : 'info',
    title: 'Embeddings Voyage (opcional)',
    message: voyageKey
      ? 'Voyage API Key configurada — RAG híbrido con embeddings.'
      : 'Sin Voyage API Key — RAG usa solo keywords locales.',
  });

  await checkEditCoreRepoArtifacts(findings);

  return findings;
}

async function checkEditCoreRepoArtifacts(findings: DiagnosticFinding[]): Promise<void> {
  const roots = new Set<string>();
  const wf = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (wf) {
    roots.add(wf);
    roots.add(path.dirname(wf));
  }

  for (const root of roots) {
    if (!root.toLowerCase().includes('editcore')) {
      continue;
    }
    const portable = path.join(root, 'VSCode-win32-x64', 'EditCore.exe');
    const userSetup = path.join(root, 'EditCoreUserSetup-x64.exe');
    const toolsDir = path.join(root, 'VSCode-win32-x64', 'tools');

    if (fs.existsSync(portable)) {
      const stat = fs.statSync(portable);
      findings.push({
        id: 'build.portable',
        category: 'editcore',
        severity: 'ok',
        title: 'Build portable EditCore',
        message: `EditCore.exe presente (${Math.round(stat.size / 1024 / 1024)} MB, ${stat.mtime.toISOString().slice(0, 10)}).`,
      });
    }

    if (fs.existsSync(userSetup)) {
      const stat = fs.statSync(userSetup);
      const portableStat = fs.existsSync(portable) ? fs.statSync(portable) : undefined;
      const outdated =
        portableStat && portableStat.mtimeMs > stat.mtimeMs + 60_000;
      findings.push({
        id: 'build.installer',
        category: 'editcore',
        severity: outdated ? 'warning' : 'ok',
        title: 'Instalador EditCoreUserSetup',
        message: outdated
          ? `Instalador más viejo (${stat.mtime.toISOString().slice(0, 10)}) que el portable.`
          : `EditCoreUserSetup-x64.exe presente (${Math.round(stat.size / 1024 / 1024)} MB).`,
        hint: outdated
          ? 'Regenerá con scripts\\build-win-installer.ps1 -SetupOnly'
          : undefined,
      });
    }

    if (fs.existsSync(toolsDir)) {
      const files = fs.readdirSync(toolsDir);
      findings.push({
        id: 'build.inno-tools',
        category: 'editcore',
        severity: files.includes('inno_updater.exe') ? 'ok' : 'warning',
        title: 'Herramientas instalador (tools/)',
        message:
          files.length > 0
            ? `${files.length} archivo(s): ${files.join(', ')}`
            : 'Carpeta tools/ vacía.',
        hint: files.includes('inno_updater.exe')
          ? undefined
          : 'Corré gulp vscode-win32-x64-user-setup (incluye inno-updater).',
      });
    }

    const launchLog = path.join(root, 'editcore-launch-err.log');
    if (fs.existsSync(launchLog)) {
      const tail = readTail(launchLog, 8000);
      const hasOnboardingErr = tail.includes('UNKNOWN service onboardingService');
      const hasNetworkCrash = tail.includes('Network service crashed');
      if (hasOnboardingErr) {
        findings.push({
          id: 'log.onboarding',
          category: 'editcore',
          severity: 'critical',
          title: 'Error onboardingService en log',
          message: 'StartupPageRunner sin IOnboardingService registrado.',
          hint: 'Recompilá editcore-src con welcomeOnboarding habilitado.',
        });
      } else if (hasNetworkCrash) {
        findings.push({
          id: 'log.network',
          category: 'editcore',
          severity: 'info',
          title: 'Log de arranque',
          message: 'Network service crash detectado (Chromium, suele recuperarse).',
        });
      }
    }
    break;
  }
}

function readTail(filePath: string, maxBytes: number): string {
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(Math.min(maxBytes, stat.size));
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return '';
  }
}
