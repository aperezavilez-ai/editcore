import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { callClaude, streamClaude, type ChatMessage } from "./anthropicClient";
import { callOpenAI, streamOpenAI } from "./openaiClient";
import { isOpenAiModelId, resolveClaudeModelId } from "./models";
import { persistClaudeModelSetting } from "./platform/modelMigration";
import { tryPrepareOrchestration } from "./orchestration/orchestratorInvoke";

export type LlmProvider = "anthropic" | "openai";

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: LlmProvider;
  usedFallback?: boolean;
}

function isFallbackEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("fallback.enabled", true);
}

function shouldFallback(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status && [401, 403, 404, 429, 500, 502, 503, 529].includes(status)) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("rate") ||
      msg.includes("crédito") ||
      msg.includes("credit") ||
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("anthropic") ||
      msg.includes("openai") ||
      msg.includes("invalida") ||
      msg.includes("inválida") ||
      msg.includes("not_found") ||
      msg.includes("no disponible") ||
      msg.includes("timeout") ||
      msg.includes("econnrefused")
    );
  }
  return true;
}

/** Enriquece mensajes con RAG del orquestador; fallback a Knowledge RAG local. */
async function enrichWithOrchestratorRag(
  messages: ChatMessage[],
  taskHint?: string
): Promise<ChatMessage[]> {
  if (!taskHint?.trim()) {
    return messages;
  }
  const prepared = await tryPrepareOrchestration(taskHint, messages);
  if (prepared?.messages && prepared.messages !== messages) {
    return prepared.messages;
  }

  const config = vscode.workspace.getConfiguration("editcore");
  if (!config.get<boolean>("knowledge.rag.enabled", true)) {
    return messages;
  }

  try {
    const { getDiagnosticRuntime } = await import("./diagnostics/diagnosticRuntime");
    const { retrieveKnowledgeContext } = await import("./knowledge/ragPipeline");
    const rt = getDiagnosticRuntime();
    if (!rt) return messages;
    const rag = await retrieveKnowledgeContext(rt.context, taskHint);
    if (!rag.contextBlock.trim()) return messages;
    const contextMessage: ChatMessage = {
      role: "user",
      content: rag.contextBlock + "\n\n---\n_RAG local EditCore (" + rag.sources.join(", ") + ")_",
    };
    return [contextMessage, ...messages];
  } catch {
    return messages;
  }
}

async function withOpenAiModelSetting<T>(model: string, fn: () => Promise<T>): Promise<T> {
  const config = vscode.workspace.getConfiguration("editcore");
  const previous = config.get<string>("openai.model");
  if (previous !== model) {
    await config.update("openai.model", model, vscode.ConfigurationTarget.Global);
  }
  try {
    return await fn();
  } finally {
    if (previous !== model) {
      await config.update("openai.model", previous, vscode.ConfigurationTarget.Global);
    }
  }
}

export async function callWithFallback(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  taskHint?: string
): Promise<{ text: string; usage: LlmUsage }> {
  const enriched = await enrichWithOrchestratorRag(messages, taskHint);

  const anthropicKey = await apiKeyService.getApiKey();
  const openaiKey = await apiKeyService.getOpenAiKey();
  const fallback = isFallbackEnabled();

  if (anthropicKey) {
    try {
      const result = await callClaude(anthropicKey, enriched);
      return {
        text: result.text,
        usage: { ...result.usage, provider: "anthropic", usedFallback: false },
      };
    } catch (err) {
      if (fallback && openaiKey && shouldFallback(err)) {
        const result = await callOpenAI(openaiKey, enriched);
        return {
          text: result.text,
          usage: { ...result.usage, usedFallback: true },
        };
      }
      throw err;
    }
  }

  if (openaiKey) {
    try {
      const result = await callOpenAI(openaiKey, enriched);
      return { text: result.text, usage: { ...result.usage, usedFallback: false } };
    } catch (err) {
      throw err;
    }
  }

  throw new Error("Configura al menos una API Key: Anthropic (Claude) u OpenAI.");
}

export async function streamForSelectedModel(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  modelId: string,
  onToken: (token: string) => void,
  options?: { allowFallback?: boolean; taskHint?: string }
): Promise<LlmUsage> {
  const allowFallback = options?.allowFallback ?? false;
  const resolvedId = isOpenAiModelId(modelId) ? modelId : resolveClaudeModelId(modelId);
  const isOpenAiModel = isOpenAiModelId(resolvedId);
  const enriched = await enrichWithOrchestratorRag(messages, options?.taskHint);

  const anthropicKey = await apiKeyService.getApiKey();
  const openaiKey = await apiKeyService.getOpenAiKey();

  if (isOpenAiModel) {
    if (!openaiKey) {
      if (allowFallback && isFallbackEnabled() && anthropicKey) {
        onToken("\n\n_⚠️ Sin key de OpenAI — usando Claude como respaldo._\n\n");
        const claudeModel = resolveClaudeModelId(
          vscode.workspace.getConfiguration("editcore").get<string>("model") ?? resolvedId
        );
        await persistClaudeModelSetting(claudeModel);
        const usage = await streamClaude(anthropicKey, enriched, onToken, claudeModel);
        return { ...usage, provider: "anthropic", model: claudeModel, usedFallback: true };
      }
      throw new Error("Configura una API Key de OpenAI en el panel de APIs.");
    }

    try {
      const usage = await withOpenAiModelSetting(resolvedId, () =>
        streamOpenAI(openaiKey, enriched, onToken)
      );
      return { ...usage, provider: "openai", model: resolvedId, usedFallback: false };
    } catch (err) {
      if (allowFallback && isFallbackEnabled() && anthropicKey && shouldFallback(err)) {
        onToken("\n\n_⚠️ OpenAI no disponible — usando Claude como respaldo._\n\n");
        const claudeModel = resolveClaudeModelId(
          vscode.workspace.getConfiguration("editcore").get<string>("model") ?? resolvedId
        );
        await persistClaudeModelSetting(claudeModel);
        const usage = await streamClaude(anthropicKey, enriched, onToken, claudeModel);
        return { ...usage, provider: "anthropic", model: claudeModel, usedFallback: true };
      }
      throw err;
    }
  }

  if (!anthropicKey) {
    if (openaiKey && isFallbackEnabled()) {
      const usage = await streamOpenAI(openaiKey, enriched, onToken);
      return { ...usage, provider: "openai", usedFallback: true };
    }
    throw new Error("Configura una API Key de Claude (Anthropic) en el panel de APIs.");
  }

  await persistClaudeModelSetting(resolvedId);

  try {
    const usage = await streamClaude(anthropicKey, enriched, onToken, resolvedId);
    return { ...usage, provider: "anthropic", model: resolvedId, usedFallback: false };
  } catch (err) {
    if (allowFallback && isFallbackEnabled() && openaiKey && shouldFallback(err)) {
      onToken("\n\n_⚠️ Claude no disponible — usando OpenAI como respaldo._\n\n");
      const usage = await streamOpenAI(openaiKey, enriched, onToken);
      return { ...usage, provider: "openai", usedFallback: true };
    }
    throw err;
  }
}

export async function streamWithFallback(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  onToken: (token: string) => void,
  taskHint?: string
): Promise<LlmUsage> {
  const enriched = await enrichWithOrchestratorRag(messages, taskHint);
  const anthropicKey = await apiKeyService.getApiKey();
  const openaiKey = await apiKeyService.getOpenAiKey();
  const fallback = isFallbackEnabled();

  if (anthropicKey) {
    try {
      const usage = await streamClaude(anthropicKey, enriched, onToken);
      return { ...usage, provider: "anthropic", usedFallback: false };
    } catch (err) {
      if (fallback && openaiKey && shouldFallback(err)) {
        onToken("\n\n_⚠️ Claude no disponible — usando OpenAI como respaldo._\n\n");
        const usage = await streamOpenAI(openaiKey, enriched, onToken);
        return { ...usage, usedFallback: true };
      }
      throw err;
    }
  }

  if (openaiKey) {
    try {
      const usage = await streamOpenAI(openaiKey, enriched, onToken);
      return { ...usage, usedFallback: false };
    } catch (err) {
      throw err;
    }
  }

  throw new Error("Configura al menos una API Key: Anthropic (Claude) u OpenAI.");
}
