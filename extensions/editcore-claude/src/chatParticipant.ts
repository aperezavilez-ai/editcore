import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { streamWithFallback } from "./aiRouter";
import { CLAUDE_MODELS } from "./models";
import type { ChatMessage } from "./anthropicClient";
import { runAgentTask, AgentEvent } from "./agent/agentLoop";
import { runOrchestratedTask, OrchestratorEvent } from "./agent/orchestrator";
import { detectRoleFromPrompt } from "./agents/roles";
import { isAgentMode } from "./chatRequestTypes";
import { appendAudit } from "./enterprise/orgConfig";
import { getSessionStore } from "./sessions/agentSessionStore";
import { enrichSessionSummary } from "./sessions/sessionSummarizer";

export function registerClaudeChatParticipant(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  const participant = vscode.chat.createChatParticipant(
    "editcore.claude",
    async (request, chatContext, stream, token) => {
      const hasAnthropic = await apiKeyService.hasApiKey();
      const hasOpenAi = await apiKeyService.hasOpenAiKey();
      if (!hasAnthropic && !hasOpenAi) {
        stream.markdown(
          "**Sin API Key configurada.** Abre **EditCore -> Cuenta & API** y pega tu key de **GPTPRO4ALL** (`sk-...`).\n\nEditCore usa Claude primero y Codex/GPT como respaldo automatico si falla."
        );
        stream.button({
          command: "editcore.openAccountPanel",
          title: "Abrir Cuenta & API",
        });
        return;
      }

      const config = vscode.workspace.getConfiguration("editcore");
      const model = config.get<string>("model", "claude-sonnet-4-6");
      const modelLabel = CLAUDE_MODELS.find((m) => m.id === model)?.label ?? model;

      if (isAgentMode(request)) {
        const apiKey = await apiKeyService.getApiKey();
        return handleAgentRequest(
          apiKey ?? "",
          request,
          chatContext,
          stream,
          token,
          apiKeyService,
          modelLabel
        );
      }

      stream.progress(`Claude (${modelLabel}) está pensando...`);

      const messages = buildMessages(chatContext.history, request.prompt);
      let fullText = "";

      try {
        const usage = await streamWithFallback(apiKeyService, messages, (chunk) => {
          if (token.isCancellationRequested) {
            return;
          }
          fullText += chunk;
          stream.markdown(chunk);
        });

        apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);

        if (!fullText.trim()) {
          stream.markdown("_(Sin respuesta de texto)_");
        }

        const providerLabel = usage.provider === "openai" ? "OpenAI" : "Claude";
        const fallbackNote = usage.usedFallback ? " · respaldo OpenAI" : "";
        stream.markdown(
          `\n\n---\n_Tokens: ↑${usage.inputTokens.toLocaleString()} ↓${usage.outputTokens.toLocaleString()} · ${providerLabel} \`${usage.model}\`${fallbackNote}_`
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error al contactar a Claude.";
        return { errorDetails: { message } };
      }
    }
  );

  participant.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "media",
    "editcore-icon.svg"
  );

  context.subscriptions.push(participant);
}

async function handleAgentRequest(
  apiKey: string,
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  apiKeyService: ApiKeyService,
  modelLabel: string
): Promise<{ errorDetails: { message: string } } | void> {
  const abortController = new AbortController();
  const cancelListener = token.onCancellationRequested(() => abortController.abort());
  let totalInput = 0;
  let totalOutput = 0;

  stream.progress(`Claude Agent (${modelLabel}) trabajando...`);

  const { role, cleanPrompt } = detectRoleFromPrompt(request.prompt);
  const task = buildAgentTask(chatContext.history, cleanPrompt, request.references);

  const sessionStore = getSessionStore();
  const session = await sessionStore.create(cleanPrompt || request.prompt, role);
  let toolCalls = 0;
  let assistantSummary = "";

  const onTool = (toolName: string) => {
    toolCalls += 1;
    apiKeyService.recordToolCall(toolName);
  };
  const onUsage = (input: number, output: number) => {
    totalInput += input;
    totalOutput += output;
    apiKeyService.recordUsage(input, output);
  };

  const hasAnthropic = Boolean(apiKey?.trim());
  const useOrchestrator =
    hasAnthropic &&
    vscode.workspace.getConfiguration("editcore").get<boolean>("orchestrator.enabled", true);

  try {
    const run = useOrchestrator
      ? runOrchestratedTask(apiKey, task, (event: OrchestratorEvent) => {
          if (token.isCancellationRequested) return;
          if (event.type === "phase") {
            stream.progress(event.message);
            return;
          }
          streamAgentEvent(event, stream, (text) => {
            assistantSummary += text;
          });
        }, abortController.signal, onUsage, onTool, role)
      : runAgentTask(
          apiKey,
          task,
          (event: AgentEvent) => {
            if (token.isCancellationRequested) return;
            streamAgentEvent(event, stream, (text) => {
              assistantSummary += text;
            });
          },
          abortController.signal,
          onUsage,
          onTool,
          role,
          apiKeyService
        );

    await run;

    const status = token.isCancellationRequested ? "cancelled" : "completed";
    const summary =
      assistantSummary.trim().slice(0, 800) ||
      cleanPrompt.slice(0, 200);
    await sessionStore.update(session.id, {
      status,
      endedAt: new Date().toISOString(),
      toolCalls,
      tokensIn: totalInput,
      tokensOut: totalOutput,
      summary,
    });
    await appendAudit({
      event: "agent_session",
      sessionId: session.id,
      role,
      status,
      toolCalls,
      tokensIn: totalInput,
      tokensOut: totalOutput,
    });

    void enrichSessionSummary(
      apiKey,
      apiKeyService,
      session.id,
      cleanPrompt || request.prompt,
      assistantSummary
    );

    if (totalInput > 0 || totalOutput > 0) {
      stream.markdown(
        `\n\n---\n_Tokens: ↑${totalInput.toLocaleString()} ↓${totalOutput.toLocaleString()} · modo Agent · \`${modelLabel}\`_`
      );
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al contactar a Claude.";
    await sessionStore.update(session.id, {
      status: "failed",
      endedAt: new Date().toISOString(),
      toolCalls,
      tokensIn: totalInput,
      tokensOut: totalOutput,
      summary: message,
    });
    await appendAudit({ event: "agent_session_failed", sessionId: session.id, role, message });
    return { errorDetails: { message } };
  } finally {
    cancelListener.dispose();
  }
}

function streamAgentEvent(
  event: AgentEvent,
  stream: vscode.ChatResponseStream,
  onAssistantText?: (text: string) => void
): void {
  switch (event.type) {
    case "assistant_text":
      onAssistantText?.(event.text);
      stream.markdown(event.text);
      break;
    case "tool_call_start":
      stream.progress(`🔧 ${event.name}…`);
      stream.markdown(
        `\n\n**🔧 ${event.name}**\n\`\`\`json\n${JSON.stringify(event.input, null, 2)}\n\`\`\`\n`
      );
      break;
    case "tool_call_result": {
      const preview =
        event.output.length > 1200
          ? `${event.output.slice(0, 1200)}\n…_(truncado)_`
          : event.output;
      stream.markdown(
        event.isError
          ? `\n❌ **Error**\n\`\`\`\n${preview}\n\`\`\`\n`
          : `\n\`\`\`\n${preview}\n\`\`\`\n`
      );
      break;
    }
    case "done":
      if (event.reason === "max_iterations") {
        stream.markdown(
          "\n\n⚠️ _El agente alcanzó el límite de iteraciones. Puedes pedirle que continúe._\n"
        );
      } else if (event.reason === "cancelled") {
        stream.markdown("\n\n_Cancelado._\n");
      }
      break;
    case "error":
      stream.markdown(`\n\n**Error:** ${event.message}\n`);
      break;
  }
}

function buildAgentTask(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  prompt: string,
  references: readonly vscode.ChatPromptReference[]
): string {
  const sections: string[] = [];

  const refLines = references
    .map((ref) => formatReference(ref))
    .filter((line): line is string => Boolean(line));
  if (refLines.length > 0) {
    sections.push(`Contexto adjunto:\n${refLines.join("\n")}`);
  }

  const historyLines = formatHistoryForAgent(history);
  if (historyLines) {
    sections.push(`Conversación previa:\n${historyLines}`);
  }

  sections.push(`Tarea actual:\n${prompt}`);
  return sections.join("\n\n");
}

function formatReference(ref: vscode.ChatPromptReference): string | undefined {
  if (typeof ref.value === "string") {
    return `- ${ref.id}: ${ref.value}`;
  }
  if (ref.value instanceof vscode.Uri) {
    return `- ${ref.id}: ${ref.value.fsPath}`;
  }
  if (ref.value && typeof ref.value === "object" && "uri" in ref.value) {
    const location = ref.value as vscode.Location;
    return `- ${ref.id}: ${location.uri.fsPath}:${location.range.start.line + 1}`;
  }
  return ref.modelDescription ? `- ${ref.id}: ${ref.modelDescription}` : undefined;
}

function formatHistoryForAgent(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): string | undefined {
  const lines: string[] = [];

  for (const turn of history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      if (turn.prompt.trim()) {
        lines.push(`Usuario: ${turn.prompt.trim()}`);
      }
      continue;
    }

    const text = turn.response
      .filter((part): part is vscode.ChatResponseMarkdownPart => {
        return part instanceof vscode.ChatResponseMarkdownPart;
      })
      .map((part) => markdownToString(part.value))
      .join("")
      .trim();

    if (text) {
      lines.push(`Asistente: ${text}`);
    }
  }

  return lines.length > 0 ? lines.join("\n\n") : undefined;
}

function buildMessages(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  prompt: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const turn of history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      if (turn.prompt.trim()) {
        messages.push({ role: "user", content: turn.prompt });
      }
      continue;
    }

    const text = turn.response
      .filter((part): part is vscode.ChatResponseMarkdownPart => {
        return part instanceof vscode.ChatResponseMarkdownPart;
      })
      .map((part) => markdownToString(part.value))
      .join("");

    if (text.trim()) {
      messages.push({ role: "assistant", content: text });
    }
  }

  messages.push({ role: "user", content: prompt });
  return messages;
}

function markdownToString(value: string | vscode.MarkdownString): string {
  return typeof value === "string" ? value : value.value;
}
