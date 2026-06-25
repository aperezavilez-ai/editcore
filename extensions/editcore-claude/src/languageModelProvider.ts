import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { streamForSelectedModel } from "./aiRouter";
import type { ChatMessage } from "./anthropicClient";
import { LLM_VENDOR } from "./llmConfig";
import { CLAUDE_MODELS, OPENAI_MODELS } from "./models";
import { prependWorkspaceContext } from "./workspace/workspaceMessages";

type NativeModelKind = "claude" | "openai";

interface NativeLanguageModelInformation extends vscode.LanguageModelChatInformation {
  kind: NativeModelKind;
  isDefault?: boolean;
}

export function registerClaudeLanguageModelProvider(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider(LLM_VENDOR, {
      async provideLanguageModelChatInformation(options, _token) {
        // VS Code re-invokes configurable providers per group (editcore/group/id vs editcore/id).
        // Models are registered only on the ungrouped call to avoid duplicates in the picker.
        const opts = options as { group?: string; configuration?: unknown };
        if (opts.group || opts.configuration) {
          return [];
        }

        const hasAnthropic = await apiKeyService.hasApiKey();
        const hasOpenAi = await apiKeyService.hasOpenAiKey();

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
          },
          kind: "openai",
          isDefault: !hasAnthropic && index === 0,
        }));

        return [...claudeModels, ...openAiModels];
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
          { allowFallback: false }
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
}

function toChatMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const message of messages) {
    const content = flattenLanguageModelParts(message.content).trim();
    if (!content) {
      continue;
    }
    if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
      result.push({ role: "assistant", content });
    } else {
      result.push({ role: "user", content });
    }
  }
  return result;
}

function flattenLanguageModelParts(parts: ReadonlyArray<unknown>): string {
  return parts
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part instanceof vscode.LanguageModelTextPart) {
        return part.value;
      }
      if (part && typeof part === "object" && "value" in part) {
        const value = (part as { value?: unknown }).value;
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .join("");
}
