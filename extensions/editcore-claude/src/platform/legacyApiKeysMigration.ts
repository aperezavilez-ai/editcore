import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const MIGRATION_FLAG = "editcore.apiKeys.migratedFromFile.v1";
const ANTHROPIC_SECRET = "anthropicApiKey";
const OPENAI_SECRET = "openaiApiKey";

export function getLegacyApiKeysFilePath(): string {
  return path.join(process.env.APPDATA || process.env.HOME || "", "EditCore", "api-keys.json");
}

export interface LegacyApiKeysMigrationResult {
  importedAnthropic: boolean;
  importedOpenAi: boolean;
  deletedLegacyFile: boolean;
}

interface LegacyApiKeysPayload {
  anthropic?: string;
  openai?: string;
}

async function secureDeleteLegacyFile(filePath: string): Promise<void> {
  try {
    await fs.promises.access(filePath);
  } catch {
    return;
  }
  await fs.promises.writeFile(filePath, "{}", { encoding: "utf8", mode: 0o600 });
  await fs.promises.unlink(filePath);
}

async function purgeLegacyBackupArtifacts(keysFile: string): Promise<void> {
  const candidates = [`${keysFile}.migrated`, `${keysFile}.bak`, `${keysFile}.old`];
  for (const candidate of candidates) {
    await secureDeleteLegacyFile(candidate);
  }
}

function readLegacyPayload(keysFile: string): LegacyApiKeysPayload | undefined {
  try {
    const raw = fs.readFileSync(keysFile, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as LegacyApiKeysPayload;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Importa api-keys.json (texto plano) a SecretStorage de editcore-claude.
 * Idempotente: no sobrescribe keys ya presentes en SecretStorage.
 */
export async function migrateLegacyApiKeysFile(
  context: vscode.ExtensionContext
): Promise<LegacyApiKeysMigrationResult> {
  const result: LegacyApiKeysMigrationResult = {
    importedAnthropic: false,
    importedOpenAi: false,
    deletedLegacyFile: false,
  };

  const keysFile = getLegacyApiKeysFilePath();
  await purgeLegacyBackupArtifacts(keysFile);

  const alreadyMigrated = Boolean(context.globalState.get<string>(MIGRATION_FLAG));
  const legacy = readLegacyPayload(keysFile);

  if (legacy?.anthropic?.trim()) {
    const existing = await context.secrets.get(ANTHROPIC_SECRET);
    if (!existing?.trim()) {
      await context.secrets.store(ANTHROPIC_SECRET, legacy.anthropic.trim());
      result.importedAnthropic = true;
    }
  }

  if (legacy?.openai?.trim()) {
    const existing = await context.secrets.get(OPENAI_SECRET);
    if (!existing?.trim()) {
      await context.secrets.store(OPENAI_SECRET, legacy.openai.trim());
      result.importedOpenAi = true;
    }
  }

  if (legacy !== undefined) {
    const hadKeys = Boolean(legacy.anthropic?.trim() || legacy.openai?.trim());
    const importedSomething = result.importedAnthropic || result.importedOpenAi;
    if (!hadKeys || importedSomething) {
      await secureDeleteLegacyFile(keysFile);
      await purgeLegacyBackupArtifacts(keysFile);
      result.deletedLegacyFile = true;
    }
  }

  if (!alreadyMigrated || result.importedAnthropic || result.importedOpenAi) {
    await context.globalState.update(MIGRATION_FLAG, new Date().toISOString());
  }

  return result;
}
