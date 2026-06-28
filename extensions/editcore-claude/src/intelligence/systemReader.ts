import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { loadMcpServers } from "../mcp/mcpConfig";
import { LLM_VENDOR } from "../llmConfig";
import { listArchitectureModules, PRIMARY_FLOWS } from "./architectureScanner";
import { redactSecrets } from "./redact";
import type { IntegrationStatus, SystemSnapshot } from "./types";

function readProductVersion(extensionPath: string): string {
  let current = extensionPath;
  for (let i = 0; i < 6; i++) {
    const versionFile = path.join(current, "VERSION");
    try {
      if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, "utf8").trim();
      }
    } catch {
      // ignore
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return String(vscode.extensions.getExtension("editcore.editcore-claude")?.packageJSON.version ?? "?");
}

function inspectEditcoreSettings(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration("editcore");
  const result: Record<string, unknown> = {};
  for (const key of [
    "model",
    "openai.model",
    "fallback.enabled",
    "orchestrator.enabled",
    "multiAgent.enabled",
    "router.autoSelect",
    "agent.alwaysWhenWorkspaceOpen",
    "rag.useEmbeddings",
    "intelligence.enabled",
    "intelligence.permissionLevel",
    "orchestrator.qdrantUrl",
    "orchestrator.qdrantCollection",
    "ollama.enabled",
    "diagnostics.useClaude",
  ]) {
    result[key] = config.get(key);
  }
  return redactSecrets(result);
}

async function probeIntegrations(apiKeyService: ApiKeyService): Promise<IntegrationStatus[]> {
  const snapshot = await apiKeyService.getSnapshot();
  const mcpServers = await loadMcpServers();
  const config = vscode.workspace.getConfiguration("editcore");

  let nativeModels = 0;
  try {
    const models = await vscode.lm.selectChatModels({ vendor: LLM_VENDOR });
    nativeModels = models.length;
  } catch {
    nativeModels = 0;
  }

  const connectExt = vscode.extensions.getExtension("editcore.editcore-connect");

  return [
    {
      id: "anthropic",
      label: "Claude (Anthropic)",
      configured: snapshot.hasApiKey,
      detail: snapshot.apiKeyHint,
    },
    {
      id: "openai",
      label: "OpenAI",
      configured: snapshot.hasOpenAiKey,
      detail: snapshot.openAiKeyHint,
    },
    {
      id: "native-lm",
      label: "Modelos nativos EditCore",
      configured: nativeModels > 0,
      detail: `${nativeModels} modelo(s) registrado(s)`,
    },
    {
      id: "qdrant",
      label: "Qdrant (RAG)",
      configured: Boolean(config.get<string>("orchestrator.qdrantUrl")),
      detail: config.get<string>("orchestrator.qdrantUrl", "http://127.0.0.1:6333"),
    },
    {
      id: "mcp",
      label: "MCP",
      configured: mcpServers.length > 0,
      detail: `${mcpServers.length} servidor(es) configurado(s)`,
    },
    {
      id: "editcore-connect",
      label: "EditCore Connect",
      configured: Boolean(connectExt?.isActive),
      detail: connectExt ? (connectExt.isActive ? "activa" : "instalada") : "no encontrada",
    },
  ];
}

function listContributedCommands(context: vscode.ExtensionContext): string[] {
  const commands = context.extension.packageJSON.contributes?.commands;
  if (!Array.isArray(commands)) {
    return [];
  }
  return commands
    .map((cmd: { command?: string }) => cmd.command)
    .filter((cmd: string | undefined): cmd is string => Boolean(cmd))
    .sort();
}

export async function buildSystemSnapshot(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<SystemSnapshot> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const keySnapshot = await apiKeyService.getSnapshot();

  return {
    generatedAt: new Date().toISOString(),
    productVersion: readProductVersion(context.extensionPath),
    extensionVersion: String(context.extension.packageJSON.version ?? "?"),
    vscodeVersion: vscode.version,
    workspaceName: folder?.name,
    workspacePath: folder?.uri.fsPath,
    modules: listArchitectureModules(context.extensionPath),
    integrations: await probeIntegrations(apiKeyService),
    settings: inspectEditcoreSettings(),
    apiKeys: {
      hasAnthropic: keySnapshot.hasApiKey,
      hasOpenAi: keySnapshot.hasOpenAiKey,
      hasOpenRouter: await apiKeyService.hasOpenRouterKey(),
      anthropicHint: keySnapshot.apiKeyHint,
      openAiHint: keySnapshot.openAiKeyHint,
    },
    commands: listContributedCommands(context),
    flows: [...PRIMARY_FLOWS],
  };
}

export function formatSystemSnapshotMarkdown(snapshot: SystemSnapshot): string {
  const lines = [
    "# EditCore System Snapshot",
    "",
    `**Generado:** ${snapshot.generatedAt}`,
    `**Producto:** ${snapshot.productVersion} · **Extensión:** ${snapshot.extensionVersion}`,
    `**VS Code:** ${snapshot.vscodeVersion}`,
    "",
  ];

  if (snapshot.workspaceName) {
    lines.push(`**Workspace:** ${snapshot.workspaceName}`, "");
  }

  lines.push("## Integraciones", "");
  for (const item of snapshot.integrations) {
    const flag = item.configured ? "✅" : "⚪";
    lines.push(`- ${flag} **${item.label}** — ${item.detail ?? "sin detalle"}`);
  }

  lines.push("", "## Módulos", "");
  for (const mod of snapshot.modules) {
    lines.push(`- **${mod.name}** (\`${mod.id}\`) — ${mod.role}`);
    lines.push(`  - \`${mod.path}\``);
  }

  lines.push("", "## Flujos principales", "");
  for (const flow of snapshot.flows) {
    lines.push(`- ${flow}`);
  }

  lines.push("", "## Settings (redacted)", "", "```json");
  lines.push(JSON.stringify(snapshot.settings, null, 2));
  lines.push("```", "");

  lines.push("## API Keys (solo hints)", "");
  lines.push(`- Claude: ${snapshot.apiKeys.hasAnthropic ? snapshot.apiKeys.anthropicHint : "no configurada"}`);
  lines.push(`- OpenAI: ${snapshot.apiKeys.hasOpenAi ? snapshot.apiKeys.openAiHint : "no configurada"}`);
  lines.push(`- OpenRouter: ${snapshot.apiKeys.hasOpenRouter ? "configurada" : "no configurada"}`);

  return lines.join("\n");
}

export function formatSystemSnapshotJson(snapshot: SystemSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
