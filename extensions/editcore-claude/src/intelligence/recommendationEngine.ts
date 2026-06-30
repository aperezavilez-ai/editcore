/**
 * recommendationEngine.ts
 * -------------------------------------------------------------------------
 * Motor de recomendaciones real y local (sin backend, sin datos multi-usuario):
 * agrega health report, uso/costos (apiKeyService) y decisiones recientes de
 * aprobación (.editcore/audit.jsonl) y le pide a Claude un análisis concreto.
 * No aplica nada automáticamente: solo genera un reporte markdown que el
 * usuario lee y, si quiere actuar, lo hace vía los flujos de aprobación ya
 * existentes (write_file / run_command).
 * -------------------------------------------------------------------------
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { createClaudeClient, mapClaudeApiError } from "../anthropicClient";
import { LLM_CONFIG } from "../llmConfig";
import { resolveClaudeModelId } from "../models";
import { readRecentAudit } from "../enterprise/orgConfig";
import { buildHealthReport } from "./healthMonitor";
import { HealthReport } from "./types";

export interface DecisionStats {
  totalDecisions: number;
  cancelled: number;
  applied: number;
  edited: number;
  cancelRate: number;
}

export interface CommandCenterData {
  health: HealthReport;
  usage: Awaited<ReturnType<ApiKeyService["getSnapshot"]>>;
  decisions: DecisionStats;
  recentDecisionLines: string[];
}

function computeDecisionStats(auditLines: string[]): { stats: DecisionStats; lines: string[] } {
  const decisionLines: string[] = [];
  let cancelled = 0;
  let applied = 0;
  let edited = 0;

  for (const line of auditLines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (entry.type !== "decision") continue;
      decisionLines.push(line);
      if (entry.action === "cancel") cancelled += 1;
      else if (entry.action === "edit") edited += 1;
      else applied += 1;
    } catch {
      // línea no-JSON o corrupta: se ignora
    }
  }

  const total = decisionLines.length;
  return {
    stats: {
      totalDecisions: total,
      cancelled,
      applied,
      edited,
      cancelRate: total > 0 ? cancelled / total : 0,
    },
    lines: decisionLines.slice(0, 15),
  };
}

export async function gatherCommandCenterData(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<CommandCenterData> {
  const health = await buildHealthReport(context, apiKeyService);
  const usage = await apiKeyService.getSnapshot();
  const auditLines = await readRecentAudit(200);
  const { stats, lines } = computeDecisionStats(auditLines);

  return { health, usage, decisions: stats, recentDecisionLines: lines };
}

export function formatCommandCenterMarkdown(data: CommandCenterData): string {
  const { health, usage, decisions } = data;
  const topTools = Object.entries(usage.toolCalls)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const byRole = Object.entries(usage.toolCallsByRole).sort((a, b) => b[1] - a[1]);

  const lines: string[] = [];
  lines.push(`# EditCore Command Center`);
  lines.push(``);
  lines.push(`_Generado: ${new Date().toISOString()}_`);
  lines.push(``);
  lines.push(`## Estado general`);
  lines.push(`- Salud: **${health.status}**`);
  lines.push(`- Diagnósticos: ${health.diagnosticSummary.critical} críticos, ${health.diagnosticSummary.warning} advertencias`);
  lines.push(``);
  lines.push(`## Uso y costos (acumulado, esta instalación)`);
  lines.push(`- Requests: ${usage.requestCount} (sesión actual: ${usage.sessionRequestCount})`);
  lines.push(`- Tokens entrada/salida: ${usage.inputTokens} / ${usage.outputTokens}`);
  lines.push(`- Costo estimado acumulado: $${usage.estimatedCostUsd.toFixed(4)} USD`);
  lines.push(`- Costo estimado sesión actual: $${usage.sessionEstimatedCostUsd.toFixed(4)} USD`);
  lines.push(``);
  lines.push(`## Tools más usadas`);
  if (topTools.length === 0) {
    lines.push(`_Sin uso de tools registrado aún._`);
  } else {
    for (const [name, count] of topTools) {
      lines.push(`- ${name}: ${count}`);
    }
  }
  lines.push(``);
  lines.push(`## Uso por agente/rol (Analítica de agentes)`);
  if (byRole.length === 0) {
    lines.push(`_Sin llamadas a tools con rol identificado aún (solo se registra cuando se invoca con @rol desde el chat principal)._`);
  } else {
    for (const [role, count] of byRole) {
      lines.push(`- @${role}: ${count} llamadas a tools`);
    }
  }
  lines.push(``);
  lines.push(`## Decisiones de aprobación (Continuous Learning, local)`);
  lines.push(`- Total registradas: ${decisions.totalDecisions}`);
  lines.push(`- Aplicadas/ejecutadas: ${decisions.applied}`);
  lines.push(`- Editadas antes de aplicar: ${decisions.edited}`);
  lines.push(`- Canceladas: ${decisions.cancelled} (${(decisions.cancelRate * 100).toFixed(0)}%)`);
  lines.push(``);
  lines.push(
    `_Nota: esto es un log local de decisiones del propio usuario en este workspace, no aprendizaje` +
      ` ni reentrenamiento del modelo — EditCore no tiene pipeline de fine-tuning. Sirve como dato de` +
      ` entrada real para el motor de recomendaciones._`
  );
  return lines.join("\n");
}

function buildRecommendationPrompt(data: CommandCenterData): string {
  const { health, usage, decisions } = data;
  return `Sos el motor de recomendaciones de EditCore. Analizá estos datos REALES y LOCALES de un único workspace (no hay datos de otros usuarios ni backend) y dame 3 a 6 recomendaciones concretas y accionables, priorizadas, en español. Cada recomendación debe decir QUÉ hacer y POR QUÉ, basado solo en estos datos — no inventes datos que no están aquí.

Salud del sistema: ${health.status}
Diagnósticos: ${health.diagnosticSummary.critical} críticos, ${health.diagnosticSummary.warning} advertencias
Hallazgos: ${health.findings.slice(0, 8).map((f) => `- [${f.severity}] ${f.title}: ${f.message}`).join("\n") || "(sin hallazgos)"}

Uso acumulado: ${usage.requestCount} requests, costo estimado $${usage.estimatedCostUsd.toFixed(2)} USD
Tools más usadas: ${Object.entries(usage.toolCalls).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n}=${c}`).join(", ") || "(sin datos)"}

Decisiones de aprobación: ${decisions.totalDecisions} totales, ${decisions.cancelled} canceladas (${(decisions.cancelRate * 100).toFixed(0)}%), ${decisions.edited} editadas antes de aplicar.

Si la tasa de cancelación es alta, sugerí causas probables (ej: el agente propone cambios demasiado grandes, falta contexto, etc.). Si no hay suficientes datos para alguna sección, decilo explícitamente en vez de inventar.`;
}

export async function generateRecommendations(
  apiKey: string,
  data: CommandCenterData
): Promise<string> {
  if (!apiKey?.trim()) {
    return "_Sin API key de Claude configurada: no se pueden generar recomendaciones con IA. Configurá una key en el panel de APIs de EditCore._";
  }
  const client = createClaudeClient(apiKey);
  const config = vscode.workspace.getConfiguration("editcore");
  const model = resolveClaudeModelId(config.get<string>("model", LLM_CONFIG.claude.defaultModel));
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: buildRecommendationPrompt(data) }],
    });
    const text = response.content
      .filter((b): b is Anthropic_TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return text || "_Claude no devolvió texto._";
  } catch (err: unknown) {
    return `_Error generando recomendaciones: ${mapClaudeApiError(err).message}_`;
  }
}

// Tipo local mínimo para evitar importar el SDK completo solo para el filtro de bloque de texto.
type Anthropic_TextBlock = { type: "text"; text: string };

export async function saveCommandCenterReport(
  context: vscode.ExtensionContext,
  markdown: string
): Promise<string | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return undefined;
  const dir = path.join(root, ".editcore", "reports");
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, `command-center-${new Date().toISOString().slice(0, 10)}.md`);
  await fs.promises.writeFile(file, markdown, "utf8");
  return file;
}
