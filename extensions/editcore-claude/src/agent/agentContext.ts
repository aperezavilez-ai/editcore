import * as vscode from "vscode";
import { assembleTaskContext, isContextAssemblerEnabled } from "../memory/contextAssembler";
import { getDiagnosticRuntime } from "../diagnostics/diagnosticRuntime";

export async function buildAgentContext(userTask: string): Promise<string> {
  if (isContextAssemblerEnabled()) {
    const rt = getDiagnosticRuntime();
    if (rt) {
      const assembled = await assembleTaskContext(rt.context, userTask, { mode: "agent" });
      return assembled.block;
    }
  }

  const sections: string[] = [];
  const { getWorkspaceContextBlock } = await import("../workspace/workspaceContext");
  const { getMemoryContextBlock } = await import("../memory/memoryManager");
  const { hybridCodeSearch } = await import("../rag/chunkIndex");

  const workspace = await getWorkspaceContextBlock();
  if (workspace) sections.push(workspace);

  const memoryBlock = await getMemoryContextBlock();
  if (memoryBlock) sections.push(memoryBlock);

  try {
    const { keyword, rag } = await hybridCodeSearch(userTask, 8);
    if (keyword) sections.push(keyword);
    if (rag) sections.push(rag);
  } catch {
    // optional
  }

  sections.push(userTask);
  return sections.join("\n\n");
}
