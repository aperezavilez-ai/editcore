import * as vscode from "vscode";
import Anthropic from "@anthropic-ai/sdk";
import { GPTPRO4ALL_CONFIG, createGptPro4AllClaudeHeaders } from "./gptpro4all.config";
import { isValidModelId } from "./models";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

function getModelConfig(): { model: string; maxTokens: number } {
  const config = vscode.workspace.getConfiguration("editcore");
  const model = config.get<string>("model", GPTPRO4ALL_CONFIG.claude.defaultModel);
  const maxTokens = config.get<number>("maxTokens", 8096);
  if (!isValidModelId(model)) {
    throw new Error(`Modelo desconocido: ${model}. Elige uno en EditCore -> Cuenta & API.`);
  }
  return { model, maxTokens };
}

export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: GPTPRO4ALL_CONFIG.claude.baseUrl,
    defaultHeaders: createGptPro4AllClaudeHeaders(apiKey),
  });
}

export function mapClaudeApiError(err: unknown): Error {
  const status = (err as { status?: number })?.status;
  if (status === 401) {
    return new Error("API key invalid. Contact support.");
  }
  if (status === 403) {
    return new Error("API key without permissions in GPTPRO4ALL. Contact support.");
  }
  if (status === 429) {
    return new Error("Rate limit reached. Wait a moment and retry.");
  }
  if (status && status >= 500) {
    return new Error("Service temporarily unavailable. Try again.");
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
      return new Error("No connection to GPTPRO4ALL. Check your internet.");
    }
    return err;
  }
  return new Error("Error desconocido al llamar a GPTPRO4ALL.");
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
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
