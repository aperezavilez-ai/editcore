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
  skippedAlreadyMigrated: boolean;
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
 *
 * FIX: antes, la flag "alreadyMigrated" se leía pero nunca se usaba para
 * frenar el proceso. Esto causaba que, incluso después de haber migrado
 * una vez, cualquier archivo api-keys.json que apareciera de nuevo (por
 * ejemplo, recreado manualmente durante pruebas) se leyera y se borrara
 * otra vez, sin volver a importar nada porque las keys ya existían en
 * SecretStorage. Ahora, si ya se migró, la función retorna de inmediato
 * y NO toca el archivo en absoluto.
 */
export async function migrateLegacyApiKeysFile(
  context: vscode.ExtensionContext
): Promise<LegacyApiKeysMigrationResult> {
  const result: LegacyApiKeysMigrationResult = {
    importedAnthropic: false,
    importedOpenAi: false,
    deletedLegacyFile: false,
    skippedAlreadyMigrated: false,
  };

  const alreadyMigrated = Boolean(context.globalState.get<string>(MIGRATION_FLAG));

  if (alreadyMigrated) {
    result.skippedAlreadyMigrated = true;
    return result;
  }

  const keysFile = getLegacyApiKeysFilePath();
  await purgeLegacyBackupArtifacts(keysFile);

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
    await secureDeleteLegacyFile(keysFile);
    await purgeLegacyBackupArtifacts(keysFile);
    result.deletedLegacyFile = true;
  }

  await context.globalState.update(MIGRATION_FLAG, new Date().toISOString());

  return result;
}

/**
 * SOLO PARA DESARROLLO / PRUEBAS.
 * Resetea la flag de migración para poder volver a probar el flujo completo
 * (crear api-keys.json de prueba, reiniciar EditCore, ver que se importe y
 * se borre correctamente) sin tener que reinstalar la extensión ni tocar
 * el código cada vez.
 */
export async function resetLegacyApiKeysMigrationFlag(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.globalState.update(MIGRATION_FLAG, undefined);
}