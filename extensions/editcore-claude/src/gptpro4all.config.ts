export const GPTPRO4ALL_CONFIG = {
  claude: {
    baseUrl: "https://api.chatgptpro4all.com",
    apiKey: "",
    defaultModel: "claude-sonnet-4-6",
    models: [
      "claude-sonnet-4-6",
      "claude-opus-4-6",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-fable-5",
    ],
  },
  codex: {
    baseUrl: "https://api.chatgptpro4all.com/v1",
    apiKey: "",
    defaultModel: "gpt-5.5",
    models: ["gpt-5.5"],
  },
} as const;

export function createGptPro4AllClaudeHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

export function getBundledClaudeApiKey(): string {
  return GPTPRO4ALL_CONFIG.claude.apiKey;
}

export function getBundledCodexApiKey(): string {
  return GPTPRO4ALL_CONFIG.codex.apiKey;
}
