import * as vscode from "vscode";
import { ChatMessage } from "../anthropicClient";

export interface OllamaResponse {
  message: { content: string };
  eval_count?: number;
  prompt_eval_count?: number;
}

export function getOllamaBaseUrl(): string {
  return vscode.workspace.getConfiguration("editcore").get<string>("ollama.baseUrl", "http://127.0.0.1:11434");
}

export async function callOllama(
  model: string,
  messages: ChatMessage[],
  apiKey?: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const base = getOllamaBaseUrl().replace(/\/$/, "");
  const ollamaMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: ollamaMessages, stream: false }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as OllamaResponse;
  return {
    text: data.message?.content ?? "",
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
  };
}

export async function listOllamaModels(): Promise<string[]> {
  const base = getOllamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/tags`);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

export async function isOllamaAvailable(): Promise<boolean> {
  const models = await listOllamaModels();
  return models.length > 0;
}
