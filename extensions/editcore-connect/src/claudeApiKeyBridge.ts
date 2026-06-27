import * as vscode from "vscode";

export interface ApiKeyStatusSnapshot {
  hasAnthropic: boolean;
  hasOpenAi: boolean;
  anthropicHint: string;
  openAiHint: string;
}

const CLAUDE_EXTENSION_ID = "editcore.editcore-claude";

export async function ensureClaudeExtensionReady(): Promise<void> {
  const ext = vscode.extensions.getExtension(CLAUDE_EXTENSION_ID);
  if (!ext) {
    throw new Error("EditCore Claude no está instalado.");
  }
  if (!ext.isActive) {
    await ext.activate();
  }
}

export async function getApiKeyStatus(): Promise<ApiKeyStatusSnapshot> {
  await ensureClaudeExtensionReady();
  return (await vscode.commands.executeCommand(
    "editcore.apiKeys.getStatus"
  )) as ApiKeyStatusSnapshot;
}

export async function saveAnthropicApiKey(key: string): Promise<void> {
  await ensureClaudeExtensionReady();
  await vscode.commands.executeCommand("editcore.apiKeys.saveAnthropic", key);
}

export async function saveOpenAiApiKey(key: string): Promise<void> {
  await ensureClaudeExtensionReady();
  await vscode.commands.executeCommand("editcore.apiKeys.saveOpenAi", key);
}

export async function clearAnthropicApiKey(): Promise<void> {
  await ensureClaudeExtensionReady();
  await vscode.commands.executeCommand("editcore.apiKeys.clearAnthropic");
}

export async function clearOpenAiApiKey(): Promise<void> {
  await ensureClaudeExtensionReady();
  await vscode.commands.executeCommand("editcore.apiKeys.clearOpenAi");
}

export async function importApiKeyIfEmpty(
  provider: "anthropic" | "openai",
  key: string
): Promise<boolean> {
  await ensureClaudeExtensionReady();
  return Boolean(
    await vscode.commands.executeCommand("editcore.apiKeys.importIfEmpty", {
      provider,
      key,
    })
  );
}
