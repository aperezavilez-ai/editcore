import * as fs from "fs";
import * as path from "path";

const KEYS_FILE = path.join(
  process.env.APPDATA || process.env.HOME || "",
  "EditCore",
  "api-keys.json"
);

export interface SharedApiKeys {
  anthropic?: string;
  openai?: string;
}

export function readSharedKeys(): SharedApiKeys {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) as SharedApiKeys;
  } catch {
    return {};
  }
}

export async function writeSharedKeys(patch: SharedApiKeys): Promise<void> {
  await fs.promises.mkdir(path.dirname(KEYS_FILE), { recursive: true });
  const current = readSharedKeys();
  const next: SharedApiKeys = { ...current, ...patch };
  if (!patch.anthropic) {
    delete next.anthropic;
  }
  if (!patch.openai) {
    delete next.openai;
  }
  await fs.promises.writeFile(KEYS_FILE, JSON.stringify(next, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}
