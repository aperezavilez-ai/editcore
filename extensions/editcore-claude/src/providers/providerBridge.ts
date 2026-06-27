import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { ChatMessage } from "../anthropicClient";
import { callClaude } from "../anthropicClient";
import { callOpenAI } from "../openaiClient";
import { callOllama } from "./ollamaClient";
import { callOpenRouter } from "./openRouterClient";
import { resolveTaskRoute, describeRoute } from "./taskRouter";
import { LlmUsage } from "../aiRouter";
import { callViaOrchestrator } from "../orchestration/orchestratorApi";

export type ExtendedProvider = "anthropic" | "openai" | "ollama" | "openrouter";

/**
 * Puente opcional de proveedores extendidos. No reemplaza el flujo principal de Claude/OpenAI.
 * Las llamadas pasan primero por orchestrator.prepare (fallback al flujo legacy si falla).
 */
export async function callExtendedProvider(
  apiKeyService: ApiKeyService,
  messages: ChatMessage[],
  hintText?: string
): Promise<{ text: string; usage: LlmUsage } | undefined> {
  const task = hintText?.trim();
  if (task) {
    const orchestrated = await callViaOrchestrator(apiKeyService, messages, task);
    if (orchestrated) {
      return orchestrated;
    }
  }

  const route = task ? resolveTaskRoute(task, messages) : undefined;
  if (!route) return undefined;

  const config = vscode.workspace.getConfiguration("editcore");

  try {
    switch (route.provider) {
      case "anthropic": {
        const key = await apiKeyService.getApiKey();
        if (!key) return undefined;
        const result = await callClaude(key, messages, route.model);
        return {
          text: result.text,
          usage: { ...result.usage, provider: "anthropic", model: route.model },
        };
      }
      case "openai": {
        const key = await apiKeyService.getOpenAiKey();
        if (!key) return undefined;
        const previous = config.get<string>("openai.model");
        if (previous !== route.model) {
          await config.update("openai.model", route.model, vscode.ConfigurationTarget.Global);
        }
        try {
          const result = await callOpenAI(key, messages);
          return {
            text: result.text,
            usage: { ...result.usage, provider: "openai", model: route.model },
          };
        } finally {
          if (previous !== route.model) {
            await config.update("openai.model", previous, vscode.ConfigurationTarget.Global);
          }
        }
      }
      case "ollama": {
        if (!config.get<boolean>("ollama.enabled", false)) return undefined;
        const result = await callOllama(route.model, messages);
        return {
          text: result.text,
          usage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            model: route.model,
            provider: "openai",
          },
        };
      }
      case "openrouter": {
        const key = await apiKeyService.getOpenRouterKey();
        if (!key) return undefined;
        const model = route.model || config.get<string>("openrouter.model", "deepseek/deepseek-chat");
        const result = await callOpenRouter(key, model, messages);
        return {
          text: result.text,
          usage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            model,
            provider: "openai",
          },
        };
      }
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

export function getActiveRouteDescription(text: string): string | undefined {
  const route = resolveTaskRoute(text);
  return route ? describeRoute(route) : undefined;
}
