import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { streamClaude, type ChatMessage } from "./anthropicClient";
import { LLM_VENDOR } from "./llmConfig";
import { CLAUDE_MODELS, OPENAI_MODELS } from "./models";
import { streamOpenAI } from "./openaiClient";

type NativeModelKind = "claude" | "openai";

interface NativeLanguageModelInformation extends vscode.LanguageModelChatInformation {
  kind: NativeModelKind;
}

export function registerClaudeLanguageModelProvider(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider(LLM_VENDOR, {
      async provideLanguageModelChatInformation(_options, _token) {
        const claudeModels = CLAUDE_MODELS.map((model): NativeLanguageModelInformation => ({
          id: model.id,
          name: model.label,
          family: "claude",
          version: "anthropic",
          tooltip: model.description,
          detail: model.tier === "premium" ? "Anthropic (economico)" : "Anthropic Claude",
          maxInputTokens: 200_000,
          maxOutputTokens: 64_000,
          capabilities: {
            toolCalling: true,
          },
          kind: "claude",
        }));

        const openAiModels = OPENAI_MODELS.map((model): NativeLanguageModelInformation => ({
          id: model.id,
          name: model.label,
          family: "gpt",
          version: "openai",
          tooltip: model.description,
          detail: "OpenAI",
          maxInputTokens: 200_000,
          maxOutputTokens: 64_000,
          capabilities: {
            toolCalling: false,
          },
          kind: "openai",
        }));

        return [...claudeModels, ...openAiModels];
      },

      async provideLanguageModelChatResponse(model, messages, _options, progress, token) {
        const chatMessages = toChatMessages(messages);
        if (chatMessages.length === 0) {
          return;
        }

        const onToken = (chunk: string) => {
          if (!token.isCancellationRequested) {
            progress.report(new vscode.LanguageModelTextPart(chunk));
          }
        };

        const isOpenAiModel = OPENAI_MODELS.some((candidate) => candidate.id === model.id);
        if (isOpenAiModel) {
          const apiKey = await apiKeyService.getOpenAiKey();
          if (!apiKey) {
            throw new Error("Configura una API Key de OpenAI en el panel izquierdo (llave) o en EditCore -> Cuenta & API.");
          }
          await withTemporaryConfig("openai.model", model.id, () => streamOpenAI(apiKey, chatMessages, onToken));
          return;
        }

        const apiKey = await apiKeyService.getApiKey();
        if (!apiKey) {
          throw new Error("Configura una API Key de Claude (Anthropic) en el panel izquierdo (llave) o en EditCore -> Cuenta & API.");
        }
        await withTemporaryConfig("model", model.id, () => streamClaude(apiKey, chatMessages, onToken));
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

async function withTemporaryConfig<T>(
  key: "model" | "openai.model",
  value: string,
  task: () => Promise<T>
): Promise<T> {
  const config = vscode.workspace.getConfiguration("editcore");
  const previous = config.get<string>(key);
  if (previous === value) {
    return task();
  }
  await config.update(key, value, vscode.ConfigurationTarget.Global);
  try {
    return await task();
  } finally {
    await config.update(key, previous, vscode.ConfigurationTarget.Global);
  }
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
