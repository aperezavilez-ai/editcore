import * as vscode from "vscode";
import Anthropic from "@anthropic-ai/sdk";
import { LLM_CONFIG } from "./llmConfig";
import { isValidModelId, resolveClaudeModelId } from "./models";

import type { ChatMessageContent } from "./chat/multimodalContent";
import { toAnthropicMessageContent } from "./chat/multimodalContent";

export interface ChatMessage {
  role: "user" | "assistant";
  content: ChatMessageContent;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

function getModelConfig(): { model: string; maxTokens: number } {
  const config = vscode.workspace.getConfiguration("editcore");
  const raw = config.get<string>("model", LLM_CONFIG.claude.defaultModel);
  const model = resolveClaudeModelId(raw);
  const maxTokens = config.get<number>("maxTokens", 8096);
  if (!isValidModelId(model)) {
    throw new Error(`Modelo desconocido: ${model}. Elige uno en EditCore -> Cuenta & API.`);
  }
  return { model, maxTokens };
}

export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: LLM_CONFIG.claude.baseUrl,
  });
}

export function mapClaudeApiError(err: unknown): Error {
  const status = (err as { status?: number })?.status;
  if (status === 401) {
    return new Error("API key de Anthropic invalida. Revisa la key en el panel de APIs.");
  }
  if (status === 403) {
    return new Error("La API key de Anthropic no tiene permisos suficientes.");
  }
  if (status === 404) {
    return new Error(
      "Modelo de Claude no disponible en tu cuenta. Cambia el modelo en EditCore → Cuenta & API."
    );
  }
  if (status === 429) {
    return new Error("Limite de uso alcanzado. Espera un momento e intenta de nuevo.");
  }
  if (status && status >= 500) {
    return new Error("Anthropic no esta disponible temporalmente. Intenta de nuevo.");
  }
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("timeout")
    ) {
      return new Error("Sin conexion con Anthropic. Revisa tu internet.");
    }
    return err;
  }
  return new Error("Error desconocido al llamar a Anthropic.");
}

export async function callClaude(
  apiKey: string,
  messages: ChatMessage[]
): Promise<{ text: string; usage: ClaudeUsage }> {
  const { model, maxTokens } = getModelConfig();
  const client = createClaudeClient(apiKey);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: messages.map((m) => ({
        role: m.role,
        content: toAnthropicMessageContent(m.content) as Anthropic.MessageParam["content"],
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text =
      textBlock && textBlock.type === "text" ? textBlock.text : "(Sin respuesta de texto)";

    return {
      text,
      usage: {
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (err) {
    throw mapClaudeApiError(err);
  }
}

export async function streamClaude(
  apiKey: string,
  messages: ChatMessage[],
  onToken: (token: string) => void
): Promise<ClaudeUsage> {
  const { model, maxTokens } = getModelConfig();
  const client = createClaudeClient(apiKey);

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      messages: messages.map((m) => ({
        role: m.role,
        content: toAnthropicMessageContent(m.content) as Anthropic.MessageParam["content"],
      })),
    });

    stream.on("text", (text) => onToken(text));
    const final = await stream.finalMessage();

    return {
      model,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    };
  } catch (err) {
    throw mapClaudeApiError(err);
  }
}
