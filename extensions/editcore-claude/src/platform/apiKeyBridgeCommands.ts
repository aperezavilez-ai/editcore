import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";

export interface ApiKeyStatusSnapshot {
  hasAnthropic: boolean;
  hasOpenAi: boolean;
  anthropicHint: string;
  openAiHint: string;
}

export type ApiKeyProvider = "anthropic" | "openai";

export function registerApiKeyBridgeCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.apiKeys.getStatus", async (): Promise<ApiKeyStatusSnapshot> => {
      const snapshot = await apiKeyService.getSnapshot();
      return {
        hasAnthropic: snapshot.hasApiKey,
        hasOpenAi: snapshot.hasOpenAiKey,
        anthropicHint: snapshot.apiKeyHint,
        openAiHint: snapshot.openAiKeyHint,
      };
    }),

    vscode.commands.registerCommand(
      "editcore.apiKeys.saveAnthropic",
      async (key: string): Promise<void> => {
        await apiKeyService.saveApiKey(String(key ?? ""));
      }
    ),

    vscode.commands.registerCommand(
      "editcore.apiKeys.saveOpenAi",
      async (key: string): Promise<void> => {
        await apiKeyService.saveOpenAiKey(String(key ?? ""));
      }
    ),

    vscode.commands.registerCommand("editcore.apiKeys.clearAnthropic", async (): Promise<void> => {
      await apiKeyService.clearApiKey();
    }),

    vscode.commands.registerCommand("editcore.apiKeys.clearOpenAi", async (): Promise<void> => {
      await apiKeyService.clearOpenAiKey();
    }),

    vscode.commands.registerCommand(
      "editcore.apiKeys.importIfEmpty",
      async (args: { provider?: ApiKeyProvider; key?: string }): Promise<boolean> => {
        const provider = args?.provider;
        const key = args?.key?.trim();
        if (!provider || !key) {
          return false;
        }
        return apiKeyService.importApiKeyIfEmpty(provider, key);
      }
    )
  );
}
