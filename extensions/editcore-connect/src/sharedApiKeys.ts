import * as fs from "fs";
import * as path from "path";

const KEYS_FILE = path.join(
  process.env.APPDATA || process.env.HOME || "",
  "EditCore",
  "api-keys.json"
);

const GPTPRO4ALL_CLAUDE_BASE_URL = "https://api.chatgptpro4all.com";
const GPTPRO4ALL_CODEX_BASE_URL = "https://api.chatgptpro4all.com/v1";

export interface SharedApiKeys {
  anthropic?: string;
  openai?: string;
}

export function getSharedKeysPath(): string {
  return KEYS_FILE;
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

export function keyHint(key?: string): string {
  if (!key) {
    return "Sin configurar";
  }
  if (key.length <= 12) {
    return "********";
  }
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

export async function validateAnthropicKey(apiKey: string): Promise<void> {
  const res = await fetch(`${GPTPRO4ALL_CLAUDE_BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  if (res.status === 429) {
    return;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GPTPRO4ALL Claude (${res.status}): ${body.slice(0, 120)}`);
  }
}

export async function validateOpenAiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${GPTPRO4ALL_CODEX_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.5",
      max_tokens: 8,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  if (res.status === 429) {
    return;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GPTPRO4ALL Codex (${res.status}): ${body.slice(0, 120)}`);
  }
}
