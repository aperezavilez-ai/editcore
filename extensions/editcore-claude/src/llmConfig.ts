import { CLAUDE_MODELS, OPENAI_MODELS } from "./models";

/** Vendor ID del proveedor de modelos nativos en VS Code / EditCore. */
export const LLM_VENDOR = "editcore";

export const LLM_CONFIG = {
  claude: {
    baseUrl: "https://api.anthropic.com",
    defaultModel: CLAUDE_MODELS[0].id,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: OPENAI_MODELS[0].id,
  },
} as const;
