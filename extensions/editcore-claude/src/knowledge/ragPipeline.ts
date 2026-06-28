/**
 * RAG Pipeline unificado — Fase 3 (Prompt 5).
 */
import * as vscode from "vscode";
import { hybridCodeSearch } from "../rag/chunkIndex";
import { searchMemory } from "../memory/memoryManager";
import { getArchitectureContext } from "../memory/architectureMemory";
import { searchChangeMemory } from "../memory/changeMemory";
import { getInteractionPreferencesBlock } from "../memory/interactionLearning";
import type { RagHit, RagPipelineResult } from "./types";
import {
  estimateTokens,
  formatHitsAsContext,
  getMaxContextTokens,
  pruneHits,
} from "./tokenOptimizer";

async function tryQdrantHits(query: string): Promise<RagHit[]> {
  try {
    const { retrieveContext } = await import("../orchestration/orchestrator");
    const { getDiagnosticRuntime } = await import("../diagnostics/diagnosticRuntime");
    const rt = getDiagnosticRuntime();
    if (!rt) {
      return [];
    }
    const config = vscode.workspace.getConfiguration("editcore");
    const { createQdrantFromEnv } = await import("../orchestration/orchestrator");
    const qdrant = createQdrantFromEnv({
      qdrantUrl: config.get<string>("orchestrator.qdrantUrl", "http://127.0.0.1:6333"),
      qdrantApiKey: config.get<string>("orchestrator.qdrantApiKey"),
      qdrantCollection: config.get<string>("orchestrator.qdrantCollection", "editcore_code"),
    });
    const { embedQuery, isEmbeddingsEnabled } = await import("../rag/voyageService");
    if (!isEmbeddingsEnabled()) {
      return [];
    }
    const retrieved = await retrieveContext(query, {
      qdrant,
      embedQuery,
    });
    const hits: RagHit[] = [];
    for (const chunk of retrieved.chunks ?? []) {
      hits.push({
        source: "qdrant",
        path: chunk.path,
        score: chunk.score ?? 0.5,
        text: chunk.text?.slice(0, 500) ?? "",
      });
    }
    return hits;
  } catch {
    return [];
  }
}

export async function retrieveKnowledgeContext(
  context: vscode.ExtensionContext,
  query: string,
  options?: { limit?: number; maxTokens?: number }
): Promise<RagPipelineResult> {
  const limit = options?.limit ?? 8;
  const maxTokens = options?.maxTokens ?? getMaxContextTokens();
  const hits: RagHit[] = [];

  try {
    const { keyword, rag } = await hybridCodeSearch(query, limit);
    if (keyword) {
      hits.push({ source: "keyword", score: 0.7, text: keyword.slice(0, 1500) });
    }
    if (rag) {
      hits.push({ source: "local_rag", score: 0.85, text: rag.slice(0, 2000) });
    }
  } catch {
    // optional
  }

  const memHits = await searchMemory(context, query, limit);
  for (const m of memHits) {
    hits.push({
      source: "memory",
      score: 0.75,
      text: "[" + m.type + "] " + m.title + "\n" + m.content.slice(0, 400),
    });
  }

  const arch = await getArchitectureContext(query);
  if (arch) {
    hits.push({ source: "architecture", score: 0.8, text: arch.slice(0, 1200) });
  }

  const changes = await searchChangeMemory(query, 5);
  for (const c of changes) {
    hits.push({
      source: "change",
      score: 0.65,
      text: c.summary.slice(0, 400),
      path: c.files?.[0],
    });
  }

  if (vscode.workspace.getConfiguration("editcore").get<boolean>("knowledge.useQdrantFallback", true)) {
    const qdrantHits = await tryQdrantHits(query);
    hits.push(...qdrantHits);
  }

  const pruned = pruneHits(hits, maxTokens);
  const prefBlock = await getInteractionPreferencesBlock();
  const contextParts = [
    formatHitsAsContext(pruned, "Conocimiento recuperado (RAG)"),
    prefBlock,
  ].filter(Boolean);

  const contextBlock = contextParts.join("\n\n");
  const sources = [...new Set(pruned.map((h) => h.source))];

  return {
    query,
    hits: pruned,
    contextBlock,
    tokenEstimate: estimateTokens(contextBlock),
    sources,
  };
}

export function isKnowledgeRagEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("knowledge.rag.enabled", true);
}
