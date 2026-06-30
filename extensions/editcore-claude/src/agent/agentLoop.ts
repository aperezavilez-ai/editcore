import * as vscode from "vscode";
import Anthropic from "@anthropic-ai/sdk";
import { ApiKeyService } from "../apiKeyService";
import { createClaudeClient, mapClaudeApiError } from "../anthropicClient";
import { LLM_CONFIG } from "../llmConfig";
import { resolveClaudeModelId } from "../models";
import { getAllAgentTools, executeAgentTool, setToolCallRecorder } from "./tools";
import { buildAgentContext } from "./agentContext";
import { AgentRoleId, buildSystemPrompt, getAllowedToolsForRole } from "../agents/roles";
import { buildAgentSystemPromptBase, getAgentCommunicationStyle } from "./communicationStyle";

const MAX_ITERATIONS = 30;

export type AgentEvent =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call_start"; name: string; input: any }
  | { type: "tool_call_result"; name: string; output: string; isError: boolean }
  | { type: "done"; reason: "finished" | "max_iterations" | "cancelled" }
  | { type: "error"; message: string };

export async function runAgentTask(
  apiKey: string,
  userTask: string,
  onEvent: (event: AgentEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (inputTokens: number, outputTokens: number) => void,
  onToolCall?: (name: string) => void,
  roleId: AgentRoleId = "default",
  apiKeyService?: ApiKeyService,
  conversation: Anthropic.Messages.MessageParam[] = []
): Promise<void> {
  const config = vscode.workspace.getConfiguration("editcore");
  const model = resolveClaudeModelId(config.get<string>("model", LLM_CONFIG.claude.defaultModel));
  const maxTokens = config.get<number>("maxTokens", 8096);

  if (!apiKey?.trim()) {
    onEvent({
      type: "error",
      message:
        "El modo Agent necesita una API Key de Claude (Anthropic) para poder leer, crear y editar archivos del proyecto: " +
        "es la única que tiene las herramientas (read_file, write_file, apply_patch, run_command, etc.) conectadas. " +
        "Configúrala en el panel de APIs (Ctrl+Alt+K). Si solo tenés una key de OpenAI, podés usarla en el chat normal, " +
        "pero ahí EditCore responde solo texto, sin tocar ningún archivo.",
    });
    return;
  }

  const client = createClaudeClient(apiKey);
  const systemPrompt = await buildSystemPrompt(buildAgentSystemPromptBase(), roleId);
  const tools = await getAllAgentTools(getAllowedToolsForRole(roleId));

  setToolCallRecorder(onToolCall);

  try {
    const enrichedTask = await buildAgentContext(userTask);
    const messages = conversation;
    messages.push({ role: "user", content: enrichedTask });

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (abortSignal?.aborted) {
        onEvent({ type: "done", reason: "cancelled" });
        return;
      }

      let response: Anthropic.Messages.Message;
      try {
        response = await client.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
            tools: tools as unknown as Anthropic.Messages.Tool[],
          },
          { signal: abortSignal }
        );
      } catch (err: unknown) {
        const claudeError = mapClaudeApiError(err);
        onEvent({
          type: "error",
          message:
            `${claudeError.message} El modo Agent no puede continuar sin Claude porque es el único proveedor con ` +
            "las herramientas de archivos conectadas; no se usa un respaldo sin herramientas para evitar respuestas " +
            "que digan poder editar código sin poder hacerlo de verdad.",
        });
        return;
      }

      onUsage?.(response.usage.input_tokens, response.usage.output_tokens);
      messages.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );

      const showIntermediateText =
        toolUseBlocks.length === 0 || getAgentCommunicationStyle() === "verbose";

      for (const block of textBlocks) {
        if (block.text.trim().length > 0 && showIntermediateText) {
          onEvent({ type: "assistant_text", text: block.text });
        }
      }

      if (toolUseBlocks.length === 0) {
        onEvent({ type: "done", reason: "finished" });
        return;
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        if (abortSignal?.aborted) {
          onEvent({ type: "done", reason: "cancelled" });
          return;
        }

        onEvent({ type: "tool_call_start", name: toolUse.name, input: toolUse.input });

        const { output, isError } = await executeAgentTool(toolUse.name, toolUse.input);

        onEvent({ type: "tool_call_result", name: toolUse.name, output, isError });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: output,
          is_error: isError,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    onEvent({ type: "done", reason: "max_iterations" });
  } finally {
    setToolCallRecorder(undefined);
  }
}
