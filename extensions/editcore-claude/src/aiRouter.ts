import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { callClaude, streamClaude, type ChatMessage } from "./anthropicClient";
import { callOpenAI, streamOpenAI } from "./openaiClient";

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
  if (status && [401, 403, 429, 500, 502, 503, 529].includes(status)) {
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
      msg.includes("timeout") ||
      msg.includes("econnrefused")
    );
  }
  return true;
}

export async function callWithFallback(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[]
): Promise<{ text: string; usage: LlmUsage }> {
  const anthropicKey = await apiKeyService.getApiKey();
  const openaiKey = await apiKeyService.getOpenAiKey();
  const fallback = isFallbackEnabled();

  if (anthropicKey) {
    try {
      const result = await callClaude(anthropicKey, messages);
      return {
        text: result.text,
        usage: { ...result.usage, provider: "anthropic", usedFallback: false },
      };
    } catch (err) {
      if (fallback && openaiKey && shouldFallback(err)) {
        const result = await callOpenAI(openaiKey, messages);
        return {
          text: result.text,
          usage: { ...result.usage, usedFallback: true },
        };
      }
      throw err;
    }
  }

  if (openaiKey) {
    const result = await callOpenAI(openaiKey, messages);
    return { text: result.text, usage: { ...result.usage, usedFallback: false } };
  }

  throw new Error("Configura al menos una API Key: Anthropic (Claude) u OpenAI.");
}

export async function streamWithFallback(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  onToken: (token: string) => void
): Promise<LlmUsage> {
  const anthropicKey = await apiKeyService.getApiKey();
  const openaiKey = await apiKeyService.getOpenAiKey();
  const fallback = isFallbackEnabled();

  if (anthropicKey) {
    try {
      const usage = await streamClaude(anthropicKey, messages, onToken);
      return { ...usage, provider: "anthropic", usedFallback: false };
    } catch (err) {
      if (fallback && openaiKey && shouldFallback(err)) {
        onToken("\n\n_⚠️ Claude no disponible — usando OpenAI como respaldo._\n\n");
        const usage = await streamOpenAI(openaiKey, messages, onToken);
        return { ...usage, usedFallback: true };
      }
      throw err;
    }
  }

  if (openaiKey) {
    const usage = await streamOpenAI(openaiKey, messages, onToken);
    return { ...usage, usedFallback: false };
  }

  throw new Error("Configura al menos una API Key: Anthropic (Claude) u OpenAI.");
}

/** Respaldo texto simple para modo Agent cuando falla Anthropic. */
export async function agentFallbackResponse(
  apiKeyService: ApiKeyService,
  userTask: string
): Promise<{ text: string; usage: LlmUsage } | undefined> {
  if (!isFallbackEnabled()) {
    return undefined;
  }
  const openaiKey = await apiKeyService.getOpenAiKey();
  if (!openaiKey) {
    return undefined;
  }
  const result = await callOpenAI(openaiKey, [
    {
      role: "user",
      content:
        `El agente Claude no está disponible. Responde como asistente de código (sin herramientas):\n\n${userTask}`,
    },
  ]);
  return {
    text: result.text,
    usage: { ...result.usage, usedFallback: true },
  };
}
