/**
 * OpenAI agent loop con herramientas — Fase 10 (Coder / implementación).
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { buildAgentContext } from "./agentContext";
import { AgentEvent } from "./agentLoop";
import { buildAgentSystemPromptBase } from "./communicationStyle";
import { getAllAgentTools, executeAgentTool, setToolCallRecorder } from "./tools";
import { buildSystemPrompt, AgentRoleId } from "../agents/roles";
import { LLM_CONFIG } from "../llmConfig";
import { mapOpenAiError } from "../openaiClient";

const MAX_ITERATIONS = 30;

type OpenAiMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

function getOpenAiCoderModel(): string {
  const config = vscode.workspace.getConfiguration("editcore");
  return config.get<string>("openai.model", LLM_CONFIG.openai.defaultModel);
}

function anthropicToolsToOpenAi(
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

export async function runOpenAiAgentTask(
  apiKey: string,
  userTask: string,
  onEvent: (event: AgentEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (inputTokens: number, outputTokens: number) => void,
  onToolCall?: (name: string) => void,
  roleId: AgentRoleId = "fullstack",
  _apiKeyService?: ApiKeyService,
  customAgentId?: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration("editcore");
  const model = getOpenAiCoderModel();
  const maxTokens = config.get<number>("maxTokens", 16384);
  const systemPrompt = await buildSystemPrompt(buildAgentSystemPromptBase(), roleId, customAgentId);
  const tools = await getAllAgentTools();
  const openAiTools = anthropicToolsToOpenAi(tools);

  setToolCallRecorder(onToolCall);

  try {
    const enrichedTask = await buildAgentContext(userTask);
    const messages: OpenAiMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: enrichedTask },
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (abortSignal?.aborted) {
        onEvent({ type: "done", reason: "cancelled" });
        return;
      }

      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages,
      };
      if (openAiTools.length > 0) {
        body.tools = openAiTools;
        body.tool_choice = "auto";
      }

      let res: Response;
      try {
        res = await fetch(`${LLM_CONFIG.openai.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: abortSignal,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: "error", message });
        return;
      }

      if (!res.ok) {
        const preview = (await res.text()).slice(0, 200);
        onEvent({ type: "error", message: mapOpenAiError(res.status, preview).message });
        return;
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      onUsage?.(data.usage?.prompt_tokens ?? 0, data.usage?.completion_tokens ?? 0);

      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        onEvent({ type: "error", message: "OpenAI devolvió respuesta vacía." });
        return;
      }

      if (msg.content?.trim()) {
        onEvent({ type: "assistant_text", text: msg.content });
      }

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        onEvent({ type: "done", reason: "finished" });
        return;
      }

      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        if (abortSignal?.aborted) {
          onEvent({ type: "done", reason: "cancelled" });
          return;
        }

        let input: unknown = {};
        try {
          input = JSON.parse(tc.function.arguments || "{}");
        } catch {
          input = {};
        }

        onEvent({ type: "tool_call_start", name: tc.function.name, input });
        const { output, isError } = await executeAgentTool(tc.function.name, input);
        onEvent({ type: "tool_call_result", name: tc.function.name, output, isError });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: output,
        });
      }
    }

    onEvent({ type: "done", reason: "max_iterations" });
  } finally {
    setToolCallRecorder(undefined);
  }
}

export function shouldUseOpenAiForRole(roleId: AgentRoleId): boolean {
  if (roleId !== "fullstack" && roleId !== "documenter") {
    return false;
  }
  return vscode.workspace.getConfiguration("editcore").get<boolean>("agent.openAiForCoder", true);
}
