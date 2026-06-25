import * as vscode from "vscode";
import { LLM_CONFIG } from "./llmConfig";
import { isValidOpenAiModelId } from "./models";
import type { ChatMessage } from "./anthropicClient";
import { toOpenAiMessageContent } from "./chat/multimodalContent";

export interface OpenAiUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: "openai";
}

function getOpenAiConfig(): { model: string; maxTokens: number } {
  const config = vscode.workspace.getConfiguration("editcore");
  const model = config.get<string>("openai.model", LLM_CONFIG.openai.defaultModel);
  const maxTokens = config.get<number>("maxTokens", 8096);
  if (!isValidOpenAiModelId(model)) {
    throw new Error(`Modelo OpenAI desconocido: ${model}. Configuralo en Cuenta & API.`);
  }
  return { model, maxTokens };
}

async function readBodyPreview(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}

function mapOpenAiError(status: number, body: string): Error {
  if (status === 401) {
    return new Error("API key de OpenAI invalida. Revisa la key en el panel de APIs.");
  }
  if (status === 403) {
    return new Error("La API key de OpenAI no tiene permisos suficientes.");
  }
  if (status === 429) {
    return new Error("Limite de uso alcanzado. Espera un momento e intenta de nuevo.");
  }
  if (status >= 500) {
    return new Error("OpenAI no esta disponible temporalmente. Intenta de nuevo.");
  }
  return new Error(`Error OpenAI (${status}): ${body}`);
}

function mapNetworkError(err: unknown): Error {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("timeout")
    ) {
      return new Error("Sin conexion con OpenAI. Revisa tu internet.");
    }
    return err;
  }
  return new Error("Error desconocido al llamar a OpenAI.");
}

export async function validateOpenAiKey(apiKey: string): Promise<void> {
  const { model } = getOpenAiConfig();
  let res: Response;
  try {
    res = await fetch(`${LLM_CONFIG.openai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
  } catch (err) {
    throw mapNetworkError(err);
  }
  if (res.status === 429) {
    return;
  }
  if (!res.ok) {
    throw mapOpenAiError(res.status, await readBodyPreview(res));
  }
}

export async function callOpenAI(
  apiKey: string,
  messages: ChatMessage[]
): Promise<{ text: string; usage: OpenAiUsage }> {
  const { model, maxTokens } = getOpenAiConfig();
  let res: Response;
  try {
    res = await fetch(`${LLM_CONFIG.openai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: messages.map((m) => ({
          role: m.role,
          content: toOpenAiMessageContent(m.content),
        })),
      }),
    });
  } catch (err) {
    throw mapNetworkError(err);
  }
  if (!res.ok) {
    throw mapOpenAiError(res.status, await readBodyPreview(res));
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim() || "(Sin respuesta de texto)";
  return {
    text,
    usage: {
      provider: "openai",
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export async function streamOpenAI(
  apiKey: string,
  messages: ChatMessage[],
  onToken: (token: string) => void
): Promise<OpenAiUsage> {
  const { model, maxTokens } = getOpenAiConfig();
  let res: Response;
  try {
    res = await fetch(`${LLM_CONFIG.openai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: messages.map((m) => ({
          role: m.role,
          content: toOpenAiMessageContent(m.content),
        })),
      }),
    });
  } catch (err) {
    throw mapNetworkError(err);
  }
  if (!res.ok) {
    throw mapOpenAiError(res.status, await readBodyPreview(res));
  }
  if (!res.body) {
    throw new Error("OpenAI no devolvio stream de respuesta.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        continue;
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          onToken(delta);
        }
        if (json.usage) {
          inputTokens = json.usage.prompt_tokens ?? inputTokens;
          outputTokens = json.usage.completion_tokens ?? outputTokens;
        }
      } catch {
        // Ignore incomplete SSE fragments.
      }
    }
  }

  return {
    provider: "openai",
    model,
    inputTokens,
    outputTokens,
  };
}
