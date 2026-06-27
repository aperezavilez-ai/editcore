import * as vscode from "vscode";
import { importApiKeyIfEmpty } from "./claudeApiKeyBridge";

const CONNECT_ANTHROPIC_SECRET = "anthropicApiKey";
const CONNECT_OPENAI_SECRET = "openaiApiKey";
const SYNC_FLAG = "editcoreConnect.apiKeys.syncedFromConnectSecrets.v1";

/**
 * Migra keys guardadas en SecretStorage de Connect (legacy) al almacén canónico de Claude.
 */
export async function syncConnectSecretsToClaude(
  context: vscode.ExtensionContext
): Promise<void> {
  const anthropic = (await context.secrets.get(CONNECT_ANTHROPIC_SECRET))?.trim();
  const openai = (await context.secrets.get(CONNECT_OPENAI_SECRET))?.trim();
  const alreadySynced = Boolean(context.globalState.get<string>(SYNC_FLAG));

  if (!anthropic && !openai) {
    if (!alreadySynced) {
      await context.globalState.update(SYNC_FLAG, new Date().toISOString());
    }
    return;
  }

  try {
    if (anthropic) {
      await importApiKeyIfEmpty("anthropic", anthropic);
    }
    if (openai) {
      await importApiKeyIfEmpty("openai", openai);
    }
  } catch {
    // Claude aún no disponible; reintentar en próxima activación.
    return;
  }

  if (anthropic) {
    await context.secrets.delete(CONNECT_ANTHROPIC_SECRET);
  }
  if (openai) {
    await context.secrets.delete(CONNECT_OPENAI_SECRET);
  }
  await context.globalState.update(SYNC_FLAG, new Date().toISOString());
}
