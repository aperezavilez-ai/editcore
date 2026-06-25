import * as vscode from "vscode";
import { ChatMessage } from "../anthropicClient";

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const openAiMessages = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://editcore.local",
      "X-Title": "EditCore IDE",
    },
    body: JSON.stringify({ model, messages: openAiMessages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as OpenRouterResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export const OPENROUTER_MODELS = [
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OpenRouter)" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenRouter)" },
];

export function getOpenRouterDefaultModel(): string {
  return vscode.workspace.getConfiguration("editcore").get<string>("openrouter.model", "deepseek/deepseek-chat");
}
