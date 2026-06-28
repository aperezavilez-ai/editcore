import * as vscode from "vscode";
import { ChatMessage } from "../anthropicClient";
import { CLAUDE_MODELS } from "../models";
import { embedQuery, isEmbeddingsEnabled } from "../rag/voyageService";
import {
  ChatTurn,
  Orchestrator,
  OrchestratorResult,
  createOrchestrator,
  createQdrantFromEnv,
} from "./orchestrator";
import { getDiagnosticRuntime } from "../diagnostics/diagnosticRuntime";
import { createValidationCaller } from "./validateGenerationBridge";

export interface PreparedOrchestration {
  plan: OrchestratorResult;
  messages: ChatMessage[];
  provider: "anthropic" | "openai";
  model: string;
}

let cachedOrchestrator: Orchestrator | undefined;

function isOrchestratorEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("orchestrator.enabled", true);
}

function getQdrantConfig(): { url: string; apiKey?: string; collection: string } {
  const config = vscode.workspace.getConfiguration("editcore");
  return {
    url: config.get<string>("orchestrator.qdrantUrl", "http://127.0.0.1:6333"),
    apiKey: config.get<string>("orchestrator.qdrantApiKey") || process.env.QDRANT_API_KEY,
    collection: config.get<string>("orchestrator.qdrantCollection", "editcore_code"),
  };
}

function getOrchestrator(): Orchestrator {
  if (!cachedOrchestrator) {
    const qdrantCfg = getQdrantConfig();
    const rt = getDiagnosticRuntime();
    cachedOrchestrator = createOrchestrator({
      qdrant: createQdrantFromEnv({
        qdrantUrl: qdrantCfg.url,
        qdrantApiKey: qdrantCfg.apiKey,
        qdrantCollection: qdrantCfg.collection,
      }),
      embedQuery: async (text: string) => {
        if (!isEmbeddingsEnabled()) {
          throw new Error("embeddings disabled");
        }
        return embedQuery(text);
      },
      validateGeneration: rt ? createValidationCaller(rt.apiKeyService) : undefined,
      selfCritiqueEnabled: vscode.workspace
        .getConfiguration("editcore")
        .get<boolean>("orchestrator.selfCritique", true),
    });
  }
  return cachedOrchestrator;
}

export function resetOrchestratorCache(): void {
  cachedOrchestrator = undefined;
}

export function chatMessagesToTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
}

export function mapOrchestratorToApiModel(
  provider: OrchestratorResult["provider"]
): string {
  if (provider === "openai") {
    return "gpt-4o";
  }
  return CLAUDE_MODELS[0].id;
}

export function enrichMessagesWithRag(
  messages: ChatMessage[],
  plan: OrchestratorResult
): ChatMessage[] {
  if (!plan.additional_context?.trim() && plan.rag_chunks.length === 0) {
    return messages;
  }

  const block =
    plan.additional_context?.trim() ||
    plan.rag_chunks
      .map((c) => `### ${c.path} (score ${(c.score ?? 0).toFixed(3)})\n${c.text}`)
      .join("\n\n");

  const contextMessage: ChatMessage = {
    role: "user",
    content: `${block}\n\n---\n_${plan.rag_trace_log || plan.context_summary}_`,
  };

  return [contextMessage, ...messages];
}

/**
 * Ejecuta orchestrator.prepare con fallback silencioso (undefined = flujo legacy).
 */
export async function tryPrepareOrchestration(
  task: string,
  messages: ChatMessage[]
): Promise<PreparedOrchestration | undefined> {
  if (!isOrchestratorEnabled() || !task.trim()) {
    return undefined;
  }

  try {
    const orchestrator = getOrchestrator();
    const plan = await orchestrator.prepare({
      task,
      history: chatMessagesToTurns(messages),
    });

    if (plan.rag_trace_log) {
      console.log(plan.rag_trace_log);
    }

    const provider = plan.provider;
    const model = mapOrchestratorToApiModel(provider);
    const enriched = enrichMessagesWithRag(messages, plan);

    return { plan, messages: enriched, provider, model };
  } catch {
    return undefined;
  }
}
