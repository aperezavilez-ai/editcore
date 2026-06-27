import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { streamForSelectedModel } from "./aiRouter";
import type { ChatMessage } from "./anthropicClient";
import { LLM_VENDOR } from "./llmConfig";
import { CLAUDE_MODELS, OPENAI_MODELS } from "./models";
import { prependWorkspaceContext } from "./workspace/workspaceMessages";
import {
  buildUserContent,
  extractImagesFromLanguageModelParts,
  messageHasText,
} from "./chat/multimodalContent";

type NativeModelKind = "claude" | "openai";

interface NativeLanguageModelInformation extends vscode.LanguageModelChatInformation {
  kind: NativeModelKind;
  isDefault?: boolean;
}

function buildModelList(
  apiKeyService: ApiKeyService
): Promise<NativeLanguageModelInformation[]> {
  return Promise.all([apiKeyService.hasApiKey(), apiKeyService.hasOpenAiKey()]).then(
    ([hasAnthropic, hasOpenAi]) => {
      const claudeModels = CLAUDE_MODELS.map((model, index): NativeLanguageModelInformation => ({
        id: model.id,
        name: model.label,
        family: "claude",
        version: "anthropic",
        tooltip: model.description,
        detail: "Anthropic Claude",
        maxInputTokens: 200_000,
        maxOutputTokens: 64_000,
        capabilities: {
          toolCalling: true,
          imageInput: true,
        },
        kind: "claude",
        isDefault: index === 0,
      }));

      const openAiModels = OPENAI_MODELS.map((model, index): NativeLanguageModelInformation => ({
        id: model.id,
        name: model.label,
        family: "gpt",
        version: "openai",
        tooltip: model.description,
        detail: "OpenAI",
        maxInputTokens: 200_000,
        maxOutputTokens: 64_000,
        capabilities: {
          toolCalling: true,
          imageInput: true,
        },
        kind: "openai",
        isDefault: !hasAnthropic && index === 0,
      }));

      return [...claudeModels, ...openAiModels];
    }
  );
}

export function registerClaudeLanguageModelProvider(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  const onDidChangeLanguageModelChatInformation = new vscode.EventEmitter<void>();

  context.subscriptions.push(
    onDidChangeLanguageModelChatInformation,
    vscode.lm.registerLanguageModelChatProvider(LLM_VENDOR, {
      onDidChangeLanguageModelChatInformation: onDidChangeLanguageModelChatInformation.event,

      provideLanguageModelChatInformation(_options, _token) {
        return buildModelList(apiKeyService);
      },

      async provideLanguageModelChatResponse(model, messages, _options, progress, token) {
        const base = toChatMessages(messages);
        const chatMessages = await prependWorkspaceContext(base);
        if (chatMessages.length === 0) {
          return;
        }

        const usage = await streamForSelectedModel(
          apiKeyService,
          chatMessages,
          model.id,
          (chunk) => {
            if (!token.isCancellationRequested) {
              progress.report(new vscode.LanguageModelTextPart(chunk));
            }
          },
          { allowFallback: true }
        );
        apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);
      },

      async provideTokenCount(_model, text, _token) {
        const value =
          typeof text === "string"
            ? text
            : flattenLanguageModelParts(text.content);
        return Math.max(1, Math.ceil(value.length / 4));
      },
    })
  );

  // Fuerza a VS Code a resolver modelos en _modelCache tras el registro del provider.
  void Promise.resolve().then(() => onDidChangeLanguageModelChatInformation.fire());
}

function toChatMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const message of messages) {
    const { text, images } = extractImagesFromLanguageModelParts(message.content);
    const content = buildUserContent(text, images);
    if (!messageHasText(content) && images.length === 0) {
      continue;
    }
    if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
      result.push({ role: "assistant", content: typeof content === "string" ? content : text });
    } else {
      result.push({ role: "user", content });
    }
  }
  return result;
}

function flattenLanguageModelParts(parts: ReadonlyArray<unknown>): string {
  return extractImagesFromLanguageModelParts(parts).text;
}
