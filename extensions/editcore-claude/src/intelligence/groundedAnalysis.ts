import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { callClaude } from "../anthropicClient";
import { callOpenAI } from "../openaiClient";
import type { HealthReport, SystemSnapshot } from "./types";
import { buildLocalAnalysis, isRateLimitError } from "./localAnalysis";

const GROUNDED_SYSTEM_PROMPT = `Eres el analista técnico de EditCore IDE.
Interpreta ÚNICAMENTE el JSON adjunto. No inventes datos. Responde en español: resumen, hallazgos, recomendaciones. Máximo 250 palabras.`;

export interface GroundedAnalysisResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  usedApi: boolean;
}

function compactPayload(snapshot: SystemSnapshot, health: HealthReport): object {
  return {
    productVersion: snapshot.productVersion,
    extensionVersion: snapshot.extensionVersion,
    healthStatus: health.status,
    summary: health.diagnosticSummary,
    findings: health.findings
      .filter((f) => f.severity !== "ok")
      .slice(0, 12)
      .map((f) => ({ severity: f.severity, title: f.title, message: f.message })),
    integrations: snapshot.integrations.map((i) => ({
      id: i.id,
      configured: i.configured,
      detail: i.detail,
    })),
    services: health.services,
    performance: health.performance,
    mcp: {
      configured: health.mcp.configuredServers,
      connected: health.mcp.connectedServers,
    },
    apiKeys: {
      claude: snapshot.apiKeys.hasAnthropic,
      openai: snapshot.apiKeys.hasOpenAi,
    },
  };
}

function getAnalysisModel(): string {
  const config = vscode.workspace.getConfiguration("editcore");
  return config.get<string>("intelligence.analysisModel", "claude-haiku-4-5");
}

async function callAnalysisLlm(
  apiKeyService: ApiKeyService,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const preferClaude = vscode.workspace
    .getConfiguration("editcore")
    .get<boolean>("intelligence.preferClaudeForAnalysis", true);

  const anthropicKey = await apiKeyService.getApiKey();
  const openaiKey = await apiKeyService.getOpenAiKey();
  const analysisModel = getAnalysisModel();

  const tryClaude = async () => {
    if (!anthropicKey) {
      throw new Error("Sin Claude");
    }
    const r = await callClaude(anthropicKey, messages, analysisModel);
    return { text: r.text, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens };
  };

  const tryOpenAi = async () => {
    if (!openaiKey) {
      throw new Error("Sin OpenAI");
    }
    const r = await callOpenAI(openaiKey, messages);
    return { text: r.text, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens };
  };

  if (preferClaude && anthropicKey) {
    try {
      return await tryClaude();
    } catch (err) {
      if (openaiKey && isRateLimitError(err)) {
        return await tryOpenAi();
      }
      throw err;
    }
  }

  if (openaiKey) {
    try {
      return await tryOpenAi();
    } catch (err) {
      if (anthropicKey && isRateLimitError(err)) {
        return await tryClaude();
      }
      throw err;
    }
  }

  return tryClaude();
}

export async function runGroundedAnalysis(
  apiKeyService: ApiKeyService,
  snapshot: SystemSnapshot,
  health: HealthReport,
  userQuestion?: string
): Promise<GroundedAnalysisResult> {
  const localFallback = (): GroundedAnalysisResult => ({
    text: buildLocalAnalysis(snapshot, health),
    inputTokens: 0,
    outputTokens: 0,
    usedApi: false,
  });

  if (!(await apiKeyService.hasAnyLlmKey())) {
    return localFallback();
  }

  const question =
    userQuestion?.trim() ||
    "Analiza el estado actual de EditCore y prioriza acciones de mejora técnicas.";

  try {
    const { text, inputTokens, outputTokens } = await callAnalysisLlm(apiKeyService, [
      { role: "user", content: GROUNDED_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Pregunta: ${question}\n\nJSON:\n${JSON.stringify(compactPayload(snapshot, health))}`,
      },
    ]);

    return { text: text.trim(), inputTokens, outputTokens, usedApi: true };
  } catch (err) {
    if (isRateLimitError(err)) {
      const local = localFallback();
      local.text =
        `_⚠️ Límite de API (429). Mostrando análisis local sin consumir cuota:_\n\n${local.text}`;
      return local;
    }
    return localFallback();
  }
}
