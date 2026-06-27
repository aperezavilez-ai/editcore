import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { ChatMessage } from "../anthropicClient";
import { callClaude, streamClaude } from "../anthropicClient";
import { callOpenAI, streamOpenAI } from "../openaiClient";
import { persistClaudeModelSetting } from "../platform/modelMigration";
import {
  PreparedOrchestration,
  tryPrepareOrchestration,
} from "./orchestratorInvoke";

export interface OrchestratedLlmUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: "anthropic" | "openai";
  usedFallback?: boolean;
}

async function withOpenAiModel<T>(
  model: string,
  fn: () => Promise<T>
): Promise<T> {
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

/** Invoca el proveedor elegido por el orquestador (sin fallback interno). */
export async function invokeOrchestratedCompletion(
  apiKeyService: ApiKeyService,
  prepared: PreparedOrchestration
): Promise<{ text: string; usage: OrchestratedLlmUsage }> {
  const { messages, provider, model } = prepared;

  if (provider === "anthropic") {
    const key = await apiKeyService.getApiKey();
    if (!key) {
      throw new Error("Sin API Key de Claude.");
    }
    await persistClaudeModelSetting(model);
    const result = await callClaude(key, messages, model);
    return {
      text: result.text,
      usage: { ...result.usage, provider: "anthropic", model },
    };
  }

  const key = await apiKeyService.getOpenAiKey();
  if (!key) {
    throw new Error("Sin API Key de OpenAI.");
  }
  const result = await withOpenAiModel(model, () => callOpenAI(key, messages));
  return {
    text: result.text,
    usage: { ...result.usage, provider: "openai", model },
  };
}

export async function invokeOrchestratedStream(
  apiKeyService: ApiKeyService,
  prepared: PreparedOrchestration,
  onToken: (token: string) => void
): Promise<OrchestratedLlmUsage> {
  const { messages, provider, model } = prepared;

  if (provider === "anthropic") {
    const key = await apiKeyService.getApiKey();
    if (!key) {
      throw new Error("Sin API Key de Claude.");
    }
    await persistClaudeModelSetting(model);
    const usage = await streamClaude(key, messages, onToken, model);
    return { ...usage, provider: "anthropic", model, usedFallback: false };
  }

  const key = await apiKeyService.getOpenAiKey();
  if (!key) {
    throw new Error("Sin API Key de OpenAI.");
  }
  const usage = await withOpenAiModel(model, () => streamOpenAI(key, messages, onToken));
  return { ...usage, provider: "openai", usedFallback: false };
}

function lastUserTask(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    return typeof msg.content === "string" ? msg.content : "";
  }
  return "";
}

/**
 * Prepara e invoca vía orquestador. Retorna undefined si prepare falla o está deshabilitado.
 */
export async function callViaOrchestrator(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  taskHint?: string
): Promise<{ text: string; usage: OrchestratedLlmUsage } | undefined> {
  const task = taskHint?.trim() || lastUserTask(messages);
  if (!task) return undefined;

  const prepared = await tryPrepareOrchestration(task, messages);
  if (!prepared) return undefined;

  try {
    return await invokeOrchestratedCompletion(apiKeyService, prepared);
  } catch {
    return undefined;
  }
}

export async function streamViaOrchestrator(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  onToken: (token: string) => void,
  taskHint?: string
): Promise<OrchestratedLlmUsage | undefined> {
  const task = taskHint?.trim() || lastUserTask(messages);
  if (!task) return undefined;

  const prepared = await tryPrepareOrchestration(task, messages);
  if (!prepared) return undefined;

  try {
    return await invokeOrchestratedStream(apiKeyService, prepared, onToken);
  } catch {
    return undefined;
  }
}
