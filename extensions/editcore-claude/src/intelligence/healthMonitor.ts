import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { runEditcoreChecks } from "../diagnostics/checks/editcoreChecks";
import { runWorkspaceChecks } from "../diagnostics/checks/workspaceChecks";
import { summarizeFindings, sortFindingsBySeverity } from "../diagnostics/diagnosticTypes";
import { McpManager } from "../mcp/mcpClient";
import { loadMcpServers } from "../mcp/mcpConfig";
import { readRecentEvents } from "../platform/observability";
import type {
  HealthReport,
  McpHealthSummary,
  PerformanceStatsSummary,
} from "./types";

interface StatsFileShape {
  version?: number;
  entries?: Array<{
    timestamp: string;
    model: string;
    latency_ms: number;
    operation: string;
    tokens_estimated: number;
  }>;
}

async function readPerformanceStats(): Promise<PerformanceStatsSummary> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return { available: false, entryCount: 0 };
  }

  const statsPath =
    process.env.EDITCORE_STATS_PATH ?? path.join(root, ".editcore", "stats.json");

  try {
    const raw = await fs.promises.readFile(statsPath, "utf8");
    const parsed = JSON.parse(raw) as StatsFileShape;
    const entries = parsed.entries ?? [];
    if (entries.length === 0) {
      return { available: true, entryCount: 0 };
    }
    const last = entries[entries.length - 1];
    const averageLatencyMs =
      entries.reduce((sum, e) => sum + (e.latency_ms ?? 0), 0) / entries.length;
    return {
      available: true,
      entryCount: entries.length,
      lastEntry: last,
      averageLatencyMs: Math.round(averageLatencyMs),
    };
  } catch {
    return { available: false, entryCount: 0 };
  }
}

async function probeMcpHealth(): Promise<McpHealthSummary> {
  const skipConnect = vscode.workspace
    .getConfiguration("editcore")
    .get<boolean>("intelligence.skipMcpProbe", true);
  const configured = await loadMcpServers();
  const servers: McpHealthSummary["servers"] = [];
  let toolCount = 0;
  let connected = 0;

  if (configured.length === 0) {
    return {
      configuredServers: 0,
      connectedServers: 0,
      toolCount: 0,
      servers: [],
    };
  }

  if (skipConnect) {
    return {
      configuredServers: configured.length,
      connectedServers: 0,
      toolCount: 0,
      servers: configured.map((s) => ({ name: s.name, connected: false })),
    };
  }

  try {
    const manager = McpManager.getInstance();
    const tools = await manager.getTools();
    toolCount = tools.length;
    const connectedNames = new Set(tools.map((tool) => tool.server));
    for (const server of configured) {
      const isConnected = connectedNames.has(server.name);
      if (isConnected) {
        connected += 1;
      }
      servers.push({ name: server.name, connected: isConnected });
    }
  } catch {
    for (const server of configured) {
      servers.push({ name: server.name, connected: false });
    }
  }

  return {
    configuredServers: configured.length,
    connectedServers: connected,
    toolCount,
    servers,
  };
}

function resolveOverallStatus(summary: ReturnType<typeof summarizeFindings>): HealthReport["status"] {
  if (summary.critical > 0) {
    return "critical";
  }
  if (summary.warning > 0) {
    return "degraded";
  }
  return "healthy";
}

export async function buildHealthReport(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<HealthReport> {
  const findings = sortFindingsBySeverity([
    ...(await runEditcoreChecks(context, apiKeyService)),
    ...(await runWorkspaceChecks()),
  ]);
  const diagnosticSummary = summarizeFindings(findings);
  const performance = await readPerformanceStats();
  const mcp = await probeMcpHealth();
  const recentEvents = await readRecentEvents(context, 20);

  const claudeExt = vscode.extensions.getExtension("editcore.editcore-claude");
  const connectExt = vscode.extensions.getExtension("editcore.editcore-connect");

  const services: HealthReport["services"] = [
    {
      id: "editcore-claude",
      label: "editcore-claude",
      status: claudeExt?.isActive ? "ok" : "error",
      message: claudeExt?.isActive ? "Extensión activa" : "Extensión no activa",
    },
    {
      id: "editcore-connect",
      label: "editcore-connect",
      status: connectExt ? (connectExt.isActive ? "ok" : "warning") : "unknown",
      message: connectExt
        ? connectExt.isActive
          ? "Extensión activa"
          : "Instalada pero inactiva"
        : "No instalada",
    },
    {
      id: "api-keys",
      label: "API Keys",
      status: (await apiKeyService.hasAnyLlmKey()) ? "ok" : "warning",
      message: (await apiKeyService.hasAnyLlmKey())
        ? "Al menos una key LLM configurada"
        : "Sin keys LLM",
    },
    {
      id: "mcp",
      label: "MCP",
      status:
        mcp.configuredServers === 0
          ? "unknown"
          : mcp.connectedServers > 0
            ? "ok"
            : "warning",
      message:
        mcp.configuredServers === 0
          ? "Sin servidores MCP configurados"
          : `${mcp.connectedServers}/${mcp.configuredServers} conectado(s)`,
    },
    {
      id: "performance-stats",
      label: "Telemetría orchestrator",
      status: performance.available ? "ok" : "unknown",
      message: performance.available
        ? `${performance.entryCount} entrada(s) en stats.json`
        : "stats.json no disponible",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: resolveOverallStatus(diagnosticSummary),
    diagnosticSummary,
    findings,
    performance,
    mcp,
    recentEvents,
    services,
  };
}

export function formatHealthReportMarkdown(report: HealthReport): string {
  const statusLabel =
    report.status === "healthy"
      ? "✅ Saludable"
      : report.status === "degraded"
        ? "⚠️ Degradado"
        : "❌ Crítico";

  const lines = [
    "# EDITCORE Health Monitor",
    "",
    `**Estado:** ${statusLabel}`,
    `**Generado:** ${report.generatedAt}`,
    "",
    "## Resumen diagnóstico",
    "",
    `- Críticos: ${report.diagnosticSummary.critical}`,
    `- Advertencias: ${report.diagnosticSummary.warning}`,
    `- Info: ${report.diagnosticSummary.info}`,
    `- OK: ${report.diagnosticSummary.ok}`,
    "",
    "## Servicios",
    "",
  ];

  for (const service of report.services) {
    lines.push(`- **${service.label}** [${service.status}]: ${service.message}`);
  }

  lines.push("", "## Rendimiento (stats.json)", "");
  if (report.performance.available && report.performance.lastEntry) {
    const last = report.performance.lastEntry;
    lines.push(`- Entradas: ${report.performance.entryCount}`);
    lines.push(`- Latencia media: ${report.performance.averageLatencyMs ?? "?"} ms`);
    lines.push(
      `- Última: ${last.operation} · ${last.model} · ${last.latency_ms} ms · ${last.tokens_estimated} tokens`
    );
  } else {
    lines.push("- Sin datos de telemetría en el workspace actual.");
  }

  lines.push("", "## MCP", "");
  lines.push(`- Configurados: ${report.mcp.configuredServers}`);
  lines.push(`- Conectados: ${report.mcp.connectedServers}`);
  lines.push(`- Herramientas: ${report.mcp.toolCount}`);
  for (const server of report.mcp.servers) {
    lines.push(`  - ${server.name}: ${server.connected ? "conectado" : "desconectado"}`);
  }

  if (report.recentEvents.length > 0) {
    lines.push("", "## Eventos recientes (observability)", "");
    for (const event of report.recentEvents.slice(0, 10)) {
      lines.push(`- [${event.ts}] **${event.level}** ${event.category}: ${event.message}`);
    }
  }

  const notable = report.findings.filter((f) => f.severity !== "ok").slice(0, 12);
  if (notable.length > 0) {
    lines.push("", "## Hallazgos", "");
    for (const finding of notable) {
      lines.push(`- **${finding.severity.toUpperCase()}** ${finding.title}: ${finding.message}`);
      if (finding.hint) {
        lines.push(`  - _${finding.hint}_`);
      }
    }
  }

  return lines.join("\n");
}
