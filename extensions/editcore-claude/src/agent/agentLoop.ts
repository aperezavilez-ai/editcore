import * as vscode from "vscode";
import Anthropic from "@anthropic-ai/sdk";
import { ApiKeyService } from "../apiKeyService";
import { agentFallbackResponse } from "../aiRouter";
import { createClaudeClient, mapClaudeApiError } from "../anthropicClient";
import { LLM_CONFIG } from "../llmConfig";
import { getAllAgentTools, executeAgentTool, setToolCallRecorder } from "./tools";
import { buildAgentContext } from "./agentContext";
import { AgentRoleId, buildSystemPrompt } from "../agents/roles";

const MAX_ITERATIONS = 30;

export type AgentEvent =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call_start"; name: string; input: any }
  | { type: "tool_call_result"; name: string; output: string; isError: boolean }
  | { type: "done"; reason: "finished" | "max_iterations" | "cancelled" }
  | { type: "error"; message: string };

const SYSTEM_PROMPT_BASE = `Eres el Agent Mode de EditCore IDE, un asistente de programacion autonomo.
Tienes herramientas para explorar, buscar, leer, parchear y escribir archivos, ejecutar comandos, git (status, diff, commit, push), analisis de impacto, gemelo digital y MCP.

Integraciones EditCore Connect (guiar al usuario cuando haga falta):
- GitHub: editcoreConnect.signInGithub, publishGithub, cloneRepo, listIssues, createIssue
- Vercel: editcoreConnect.setVercelToken, deployVercel
- Supabase: editcoreConnect.setSupabaseToken, linkSupabase, initSupabase
- APIs Claude/OpenAI: editcoreConnect.openApis o editcore.openAccountPanel
- Browser local: sugiere abrir http://localhost:PORT (EditCore abre links locales en el navegador integrado)

Reglas:
- Explora con list_directory, glob_files, search_files o search_codebase antes de editar.
- Usa analyze_impact o twin_query antes de cambios riesgosos en modulos compartidos.
- Prefiere apply_patch para cambios pequenos; write_file solo para archivos nuevos o reescrituras totales.
- Comandos de terminal y cambios de archivo requieren aprobacion del usuario.
- Si el usuario rechaza algo, no lo reintentes sin preguntar.
- Cuando termines, resume en texto plano SIN llamar mas tools.
- Tareas destructivas o ambiguas: pregunta antes en texto.
- Usa write_adr para decisiones de arquitectura importantes.
- Usa append_memory para guardar decisiones importantes en .editcore/memory.md.
- Roles: @architect @fullstack @devops @qa @gps @founder @cto @saas en el mensaje.`;

export async function runAgentTask(
  apiKey: string,
  userTask: string,
  onEvent: (event: AgentEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (inputTokens: number, outputTokens: number) => void,
  onToolCall?: (name: string) => void,
  roleId: AgentRoleId = "default",
  apiKeyService?: ApiKeyService
): Promise<void> {
  const config = vscode.workspace.getConfiguration("editcore");
  const model = config.get<string>("model", LLM_CONFIG.claude.defaultModel);
  const maxTokens = config.get<number>("maxTokens", 8096);

  if (!apiKey?.trim()) {
    if (apiKeyService) {
      const fallback = await agentFallbackResponse(apiKeyService, userTask);
      if (fallback) {
        onEvent({
          type: "assistant_text",
          text: `_Sin clave Claude; respuesta con OpenAI sin herramientas._\n\n${fallback.text}`,
        });
        onUsage?.(fallback.usage.inputTokens, fallback.usage.outputTokens);
        onEvent({ type: "done", reason: "finished" });
        return;
      }
    }
    onEvent({
      type: "error",
      message: "Configura una API Key de Claude o OpenAI en el panel de APIs.",
    });
    return;
  }

  const client = createClaudeClient(apiKey);
  const systemPrompt = await buildSystemPrompt(SYSTEM_PROMPT_BASE, roleId);
  const tools = await getAllAgentTools();

  setToolCallRecorder(onToolCall);

  try {
    const enrichedTask = await buildAgentContext(userTask);
    const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: enrichedTask }];

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
        if (apiKeyService) {
          try {
            const fallback = await agentFallbackResponse(apiKeyService, userTask);
            if (fallback) {
              onEvent({
                type: "assistant_text",
                text: `_Claude no disponible; respuesta con OpenAI sin herramientas._\n\n${fallback.text}`,
              });
              onUsage?.(fallback.usage.inputTokens, fallback.usage.outputTokens);
              onEvent({ type: "done", reason: "finished" });
              return;
            }
          } catch {
            // Keep the original Claude error below.
          }
        }
        onEvent({ type: "error", message: mapClaudeApiError(err).message });
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

      for (const block of textBlocks) {
        if (block.text.trim().length > 0) {
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
