/**
 * Context assembler unificado — Fase 7 (Prompt 5).
 */
import * as vscode from "vscode";
import { getMemoryContextBlock } from "./memoryManager";
import { getConversationContextBlock } from "./conversationMemory";
import { getArchitectureContext } from "./architectureMemory";
import { getProjectScopedMemoryBlock } from "./multiProjectMemory";
import { retrieveKnowledgeContext, isKnowledgeRagEnabled } from "../knowledge/ragPipeline";
import { formatProjectKnowledgeMarkdown, loadProjectKnowledgeMap } from "../knowledge/projectKnowledgeEngine";
import { getWorkspaceContextBlock } from "../workspace/workspaceContext";
import { listChangeRecords } from "./changeMemory";
import { getMaxContextTokens } from "../knowledge/tokenOptimizer";

export type ContextMode = "agent" | "ask" | "task";

export interface AssembledContext {
  block: string;
  tokenEstimate: number;
  sections: string[];
}

export async function assembleTaskContext(
  context: vscode.ExtensionContext,
  userTask: string,
  options?: { mode?: ContextMode; includeRecentChanges?: boolean }
): Promise<AssembledContext> {
  const mode = options?.mode ?? "agent";
  const sections: string[] = [];
  const maxTokens = getMaxContextTokens();

  const workspace = await getWorkspaceContextBlock();
  if (workspace) {
    sections.push(workspace);
  }

  const projectMap = await loadProjectKnowledgeMap();
  if (projectMap) {
    sections.push(formatProjectKnowledgeMarkdown(projectMap).slice(0, 2500));
  }

  const memoryBlock = await getMemoryContextBlock();
  if (memoryBlock) {
    sections.push(memoryBlock);
  }

  const convBlock = await getConversationContextBlock();
  if (convBlock) {
    sections.push(convBlock);
  }

  const archBlock = await getArchitectureContext(userTask);
  if (archBlock) {
    sections.push(archBlock);
  }

  const projectScoped = await getProjectScopedMemoryBlock(context, userTask);
  if (projectScoped) {
    sections.push(projectScoped);
  }

  if (options?.includeRecentChanges !== false) {
    const changes = await listChangeRecords(undefined, 3);
    if (changes.length) {
      sections.push(
        "## Cambios recientes\n" +
          changes.map((c) => "- " + c.summary).join("\n")
      );
    }
  }

  if (isKnowledgeRagEnabled()) {
    const rag = await retrieveKnowledgeContext(context, userTask, { maxTokens: Math.floor(maxTokens * 0.4) });
    if (rag.contextBlock) {
      sections.push(rag.contextBlock);
    }
  } else if (mode === "agent") {
    const { hybridCodeSearch } = await import("../rag/chunkIndex");
    try {
      const { keyword, rag } = await hybridCodeSearch(userTask, 6);
      if (keyword) sections.push(keyword);
      if (rag) sections.push(rag);
    } catch {
      // optional
    }
  }

  sections.push(userTask);

  const block = sections.join("\n\n");
  const tokenEstimate = Math.ceil(block.length / 4);

  if (tokenEstimate > maxTokens) {
    const trimmed = sections.slice(0, -1);
    const task = sections[sections.length - 1];
    let acc = "";
    for (const s of trimmed) {
      if (acc.length + s.length > maxTokens * 4) break;
      acc += (acc ? "\n\n" : "") + s;
    }
    return {
      block: acc + "\n\n" + task,
      tokenEstimate: Math.ceil((acc.length + task.length) / 4),
      sections: trimmed.map((_, i) => "section-" + i).concat(["task"]),
    };
  }

  return { block, tokenEstimate, sections: sections.map((_, i) => "section-" + i) };
}

export function isContextAssemblerEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("knowledge.contextAssembler.enabled", true);
}
