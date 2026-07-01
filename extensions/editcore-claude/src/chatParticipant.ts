import * as vscode from "vscode";
import type Anthropic from "@anthropic-ai/sdk";
import { ApiKeyService } from "./apiKeyService";
import { streamForSelectedModel } from "./aiRouter";
import { LLM_CONFIG } from "./llmConfig";
import { CLAUDE_MODELS, OPENAI_MODELS, resolveClaudeModelId, isOpenAiModelId } from "./models";
import type { ChatMessage } from "./anthropicClient";
import { runAgentTask, AgentEvent } from "./agent/agentLoop";
import { shouldSkipOrchestratorPlan } from "./agent/orchestratorPolicy";
import { runOrchestratedTask, OrchestratorEvent } from "./agent/orchestrator";
import { runMultiAgentPipeline, MultiAgentEvent, isMultiAgentEnabled } from "./agent/multiAgentOrchestrator";
import { detectRoleFromPrompt } from "./agents/roles";
import { shouldUseAgentLoop } from "./chatRequestTypes";
import { appendAudit } from "./enterprise/orgConfig";
import { getSessionStore } from "./sessions/agentSessionStore";
import { enrichSessionSummary } from "./sessions/sessionSummarizer";
import { getWorkspaceContextBlock } from "./workspace/workspaceContext";
import { prependWorkspaceContext } from "./workspace/workspaceMessages";
import {
  buildUserContent,
  messageHasText,
  resolveImagesFromReferences,
} from "./chat/multimodalContent";
import {
  shouldShowAgentPhasesInChat,
  shouldShowToolProgressInChat,
  getAgentCommunicationStyle,
} from "./agent/communicationStyle";
import { sanitizeAssistantText, isSubstantiveAssistantText } from "./agent/responseSanitizer";
import {
  isSystemIntelligenceQuery,
  isAutonomyExecuteQuery,
  isAutonomousDeveloperQuery,
  extractAutonomousObjective,
} from "./intelligence/intelligenceQuery";
import { runAutonomyCycle } from "./autonomy/autonomyEngine";
import { buildAutonomyAgentTaskFromQueue } from "./autonomy/autonomyCommands";
import { runAutonomousTaskEngine } from "./autonomous/taskEngine";

async function handleRealAutonomyRequest(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  stream: vscode.ChatResponseStream,
  userQuestion?: string
): Promise<void> {
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "EditCore: autonomía real (datos + tareas)...",
      cancellable: false,
    },
    () => runAutonomyCycle(context, apiKeyService)
  );
  stream.markdown(result.markdown);
  if (result.cursorPromptPath) {
    stream.button({
      command: "vscode.open",
      title: "Abrir prompts para Cursor",
      arguments: [vscode.Uri.file(result.cursorPromptPath)],
    });
  }
  if (result.queuePath) {
    stream.button({
      command: "vscode.open",
      title: "Abrir cola de tareas",
      arguments: [vscode.Uri.file(result.queuePath)],
    });
  }
  if (result.savedMapPath) {
    stream.button({
      command: "vscode.open",
      title: "Abrir mapa del sistema",
      arguments: [vscode.Uri.file(result.savedMapPath)],
    });
  }
  stream.button({
    command: "editcore.autonomy.execute",
    title: "Ejecutar siguiente tarea (agente)",
  });
  stream.button({
    command: "editcore.evolution.cycle",
    title: "Ciclo evolución completo (reportes + prompt)",
  });
  if (userQuestion && isAutonomyExecuteQuery(userQuestion)) {
    stream.markdown(
      "\n\n_Para ejecutar con herramientas, usa **Agent** y escribe «ejecuta las tareas de autonomía» o el botón de arriba._"
    );
  }
}

async function handleStreamingChatRequest(
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  apiKeyService: ApiKeyService,
  selectedModelId: string
): Promise<{ errorDetails: { message: string } } | void> {
  const messages = await buildMessages(
    chatContext.history,
    request.prompt,
    request.references
  );
  let fullText = "";

  try {
    const usage = await streamForSelectedModel(
      apiKeyService,
      messages,
      selectedModelId,
      (chunk) => {
        if (token.isCancellationRequested) {
          return;
        }
        fullText += chunk;
        stream.markdown(chunk);
      },
      { allowFallback: true, taskHint: request.prompt }
    );
    apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);

    if (!fullText.trim()) {
      stream.markdown("_(Sin respuesta de texto)_");
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al contactar al proveedor de IA.";
    return { errorDetails: { message } };
  }
}

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
          "**Sin API Key configurada.** Abre el panel de **API Keys** (icono de llave en la barra izquierda) y pega tu key de **Claude (Anthropic)** o **OpenAI** (`sk-...`).\n\nEditCore usa Claude primero y OpenAI como respaldo automatico si falla."
        );
        stream.button({
          command: "editcore.openAccountPanel",
          title: "Abrir Cuenta & API",
        });
        return;
      }

      const config = vscode.workspace.getConfiguration("editcore");
      const rawModelId =
        request.model?.id ?? config.get<string>("model", LLM_CONFIG.claude.defaultModel);
      const selectedModelId = isOpenAiModelId(rawModelId)
        ? rawModelId
        : resolveClaudeModelId(rawModelId);
      const modelLabel =
        CLAUDE_MODELS.find((m) => m.id === selectedModelId)?.label ??
        OPENAI_MODELS.find((m) => m.id === selectedModelId)?.label ??
        selectedModelId;

      if (isSystemIntelligenceQuery(request.prompt)) {
        try {
          await handleRealAutonomyRequest(
            context,
            apiKeyService,
            stream,
            request.prompt
          );
          return;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Error al ejecutar autonomía real.";
          return { errorDetails: { message } };
        }
      }

      if (isAutonomousDeveloperQuery(request.prompt) && shouldUseAgentLoop(request)) {
        const objective = extractAutonomousObjective(request.prompt);
        if (objective) {
          try {
            const result = await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: "EditCore: desarrollador autónomo...",
                cancellable: false,
              },
              () => runAutonomousTaskEngine(context, apiKeyService, { objective })
            );
            stream.markdown(result.markdown);
            stream.button({
              command: "editcore.autonomous.openWorkbench",
              title: "Historial de tareas",
            });
            return;
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Error en desarrollador autónomo.";
            return { errorDetails: { message } };
          }
        }
      }

      if (isAutonomyExecuteQuery(request.prompt) && shouldUseAgentLoop(request)) {
        const apiKey = await apiKeyService.getApiKey();
        if (!apiKey?.trim()) {
          stream.markdown(
            "**Sin API Key de Claude.** Configura la key para ejecutar tareas con el agente real."
          );
          return;
        }
        try {
          await handleRealAutonomyRequest(context, apiKeyService, stream, request.prompt);
          const agentTask = await buildAutonomyAgentTaskFromQueue();
          return handleAgentRequest(
            apiKey,
            { ...request, prompt: agentTask } as vscode.ChatRequest,
            chatContext,
            stream,
            token,
            apiKeyService,
            modelLabel,
            selectedModelId
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Error al ejecutar tareas de autonomía.";
          return { errorDetails: { message } };
        }
      }

      if (shouldUseAgentLoop(request) && !isOpenAiModelId(selectedModelId)) {
        const apiKey = await apiKeyService.getApiKey();
        return handleAgentRequest(
          apiKey ?? "",
          request,
          chatContext,
          stream,
          token,
          apiKeyService,
          modelLabel,
          selectedModelId
        );
      }

      return handleStreamingChatRequest(
        request,
        chatContext,
        stream,
        token,
        apiKeyService,
        selectedModelId
      );
    }
  );

  context.subscriptions.push(participant);
}

/**
 * Memoria real de conversación entre mensajes del Agent, por workspace.
 *
 * Antes: cada mensaje nuevo empezaba con una conversación vacía y solo un
 * resumen en texto plano del historial — el modelo perdía el detalle real
 * de lo que ya había leído/escrito y tenía que re-explorar todo de nuevo
 * en cada mensaje, gastando iteraciones y tiempo.
 *
 * Ahora: se guarda el array real de mensajes (incluyendo las llamadas a
 * herramientas y sus resultados) mientras el usuario siga en la misma
 * sesión de chat de ese workspace. Se resetea automáticamente cuando
 * chatContext.history está vacío (chat nuevo / primer mensaje).
 */
const agentConversationStore = new Map<string, Anthropic.Messages.MessageParam[]>();
const MAX_CONVERSATION_MESSAGES = 40;

function getConversationKey(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "no-workspace";
}

function getOrResetConversation(isNewSession: boolean): Anthropic.Messages.MessageParam[] {
  const key = getConversationKey();
  if (isNewSession) {
    agentConversationStore.delete(key);
  }
  const existing = agentConversationStore.get(key);
  if (existing) {
    return existing;
  }
  const fresh: Anthropic.Messages.MessageParam[] = [];
  agentConversationStore.set(key, fresh);
  return fresh;
}

function trimConversation(conversation: Anthropic.Messages.MessageParam[]): void {
  if (conversation.length > MAX_CONVERSATION_MESSAGES) {
    conversation.splice(0, conversation.length - MAX_CONVERSATION_MESSAGES);
  }
}

async function handleAgentRequest(
  apiKey: string,
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  apiKeyService: ApiKeyService,
  _modelLabel: string,
  _selectedModelId: string
): Promise<{ errorDetails: { message: string } } | void> {
  const abortController = new AbortController();
  const cancelListener = token.onCancellationRequested(() => abortController.abort());
  let totalInput = 0;
  let totalOutput = 0;
  const conversation = getOrResetConversation(chatContext.history.length === 0);

  const { role, cleanPrompt, customAgentId } = detectRoleFromPrompt(request.prompt);
  let taskPrompt = cleanPrompt || request.prompt;

  if (customAgentId) {
    void import("./ecosystem/usageAnalytics").then((m) => m.trackUsage("agentsUsed"));
  }

  if (isSystemIntelligenceQuery(taskPrompt)) {
    try {
      const rt = (await import("./diagnostics/diagnosticRuntime")).getDiagnosticRuntime();
      if (rt) {
        await handleRealAutonomyRequest(rt.context, apiKeyService, stream, taskPrompt);
        return;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al ejecutar autonomía real.";
      return { errorDetails: { message } };
    }
  }

  if (isAutonomyExecuteQuery(taskPrompt)) {
    try {
      const rt = (await import("./diagnostics/diagnosticRuntime")).getDiagnosticRuntime();
      if (rt) {
        await handleRealAutonomyRequest(rt.context, apiKeyService, stream, taskPrompt);
      }
      taskPrompt = await buildAutonomyAgentTaskFromQueue();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al ejecutar tareas de autonomía.";
      return { errorDetails: { message } };
    }
  }

  const task = await buildAgentTask(chatContext.history, taskPrompt, request.references);

  const sessionStore = getSessionStore();
  const session = await sessionStore.create(cleanPrompt || request.prompt, role);
  let toolCalls = 0;
  let assistantSummary = "";

  const onTool = (toolName: string) => {
    toolCalls += 1;
    apiKeyService.recordToolCall(toolName, role);
  };
  const onUsage = (input: number, output: number) => {
    totalInput += input;
    totalOutput += output;
    apiKeyService.recordUsage(input, output);
  };

  const hasAnthropic = Boolean(apiKey?.trim());
  const useMultiAgent = hasAnthropic && isMultiAgentEnabled();
  const useOrchestrator =
    hasAnthropic &&
    !useMultiAgent &&
    !shouldSkipOrchestratorPlan(cleanPrompt || request.prompt) &&
    vscode.workspace.getConfiguration("editcore").get<boolean>("orchestrator.enabled", false);

  const emitAgentEvent = createAgentEventStreamer(stream, (text) => {
    assistantSummary += text;
  });

  try {
    const run = useMultiAgent
      ? runMultiAgentPipeline(apiKey, task, (event: MultiAgentEvent) => {
          if (token.isCancellationRequested) return;
          if (event.type === "phase") {
            if (shouldShowAgentPhasesInChat()) {
              stream.markdown(`\n**${event.agent}** — ${event.message}\n`);
            }
            return;
          }
          emitAgentEvent(event);
        }, abortController.signal, onUsage, onTool, apiKeyService)
      : useOrchestrator
      ? runOrchestratedTask(apiKey, task, (event: OrchestratorEvent) => {
          if (token.isCancellationRequested) return;
          if (event.type === "phase") {
            if (shouldShowAgentPhasesInChat()) {
              stream.markdown(`\n_${event.message}_\n`);
            }
            return;
          }
          emitAgentEvent(event);
        }, abortController.signal, onUsage, onTool, role)
      : runAgentTask(
          apiKey,
          task,
          (event: AgentEvent) => {
            if (token.isCancellationRequested) return;
            emitAgentEvent(event);
          },
          abortController.signal,
          onUsage,
          onTool,
          role,
          apiKeyService,
          conversation,
          customAgentId
        );

    await run;
    trimConversation(conversation);

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

function describeToolProgress(name: string, input: any): string {
  const path = typeof input?.path === "string" ? input.path : undefined;
  switch (name) {
    case "read_file":
      return path ? `Leyendo ${path}…` : "Leyendo archivo…";
    case "write_file":
      return path ? `Escribiendo ${path}…` : "Escribiendo archivo…";
    case "apply_patch":
      return path ? `Editando ${path}…` : "Editando archivo…";
    case "list_directory":
      return path ? `Explorando ${path}…` : "Explorando carpeta…";
    case "search_codebase":
      return "Buscando en el código…";
    case "run_command":
      return typeof input?.command === "string" ? `Ejecutando: ${input.command}` : "Ejecutando comando…";
    default:
      return `Usando herramienta ${name}…`;
  }
}

const CURSOR_REASSURANCE_PHRASES = [
  "Pensando…",
  "Trabajando en la tarea…",
  "Sigue en proceso…",
  "Un momento más…",
  "Avanzando…",
];

function createAgentEventStreamer(
  stream: vscode.ChatResponseStream,
  onAssistantText?: (text: string) => void
): (event: AgentEvent) => void {
  const cursorMode = getAgentCommunicationStyle() === "cursor";
  let pendingFinalText = "";
  let shownThinkingLine = false;
  let phraseIndex = 0;
  let toolCallsSincePing = 0;
  const PING_EVERY_N_TOOLS = 3;

  const pingProgress = () => {
    stream.progress(CURSOR_REASSURANCE_PHRASES[phraseIndex % CURSOR_REASSURANCE_PHRASES.length]);
    phraseIndex++;
    shownThinkingLine = true;
    toolCallsSincePing = 0;
  };

  return (event: AgentEvent) => {
    switch (event.type) {
      case "assistant_text": {
        const clean = sanitizeAssistantText(event.text);
        if (!isSubstantiveAssistantText(clean)) {
          break;
        }
        onAssistantText?.(clean);
        if (cursorMode) {
          pendingFinalText = clean;
          if (!shownThinkingLine) {
            pingProgress();
          }
        } else {
          stream.markdown(clean);
        }
        break;
      }
      case "tool_call_start":
        if (cursorMode) {
          if (!shownThinkingLine) {
            pingProgress();
          } else {
            toolCallsSincePing++;
            if (toolCallsSincePing >= PING_EVERY_N_TOOLS) {
              pingProgress();
            }
          }
        } else {
          stream.progress(describeToolProgress(event.name, event.input));
        }
        if (shouldShowToolProgressInChat()) {
          stream.markdown(`\n🔧 **${event.name}**\n`);
        }
        break;
      case "tool_call_result":
        if (event.isError) {
          stream.markdown(`\n❌ ${event.output.slice(0, 500)}\n`);
        }
        break;
      case "done":
        if (cursorMode && pendingFinalText) {
          stream.markdown(pendingFinalText);
          pendingFinalText = "";
        }
        if (event.reason === "max_iterations") {
          stream.markdown("\n\n_El agente alcanzó el límite de iteraciones. Puedes pedirle que continúe._\n");
        }
        break;
      case "error":
        stream.markdown(`\n\n${event.message}\n`);
        break;
    }
  };
}

function buildAgentTask(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  prompt: string,
  references: readonly vscode.ChatPromptReference[]
): Promise<string> {
  return buildAgentTaskAsync(history, prompt, references);
}

async function buildAgentTaskAsync(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  prompt: string,
  references: readonly vscode.ChatPromptReference[]
): Promise<string> {
  const sections: string[] = [];

  const workspace = await getWorkspaceContextBlock();
  if (workspace) {
    sections.push(workspace);
  }

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
  const value = ref.value as unknown;
  if (
    value &&
    typeof value === "object" &&
    "mimeType" in value &&
    "data" in value &&
    typeof (value as { data: unknown }).data === "function"
  ) {
    const mime = (value as { mimeType?: string }).mimeType ?? "image";
    return `- ${ref.id}: imagen adjunta (${mime})`;
  }
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
  prompt: string,
  references: readonly vscode.ChatPromptReference[]
): Promise<ChatMessage[]> {
  return buildMessagesAsync(history, prompt, references);
}

async function buildMessagesAsync(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  prompt: string,
  references: readonly vscode.ChatPromptReference[]
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];

  for (const turn of history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      const images = await resolveImagesFromReferences(turn.references);
      const content = buildUserContent(turn.prompt, images);
      if (messageHasText(content) || images.length > 0) {
        messages.push({ role: "user", content });
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

  const images = await resolveImagesFromReferences(references);
  messages.push({ role: "user", content: buildUserContent(prompt, images) });
  return prependWorkspaceContext(messages);
}

function markdownToString(value: string | vscode.MarkdownString): string {
  return typeof value === "string" ? value : value.value;
}