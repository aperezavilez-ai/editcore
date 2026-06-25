export interface ClaudeModelOption {
  id: string;
  label: string;
  description: string;
  tier: "balanced" | "powerful" | "premium";
}

/** Claude models available through GPTPRO4ALL. */
export const CLAUDE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Default GPTPRO4ALL model: fast, stable, and high quality",
    tier: "balanced",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    description: "More powerful model for complex tasks",
    tier: "powerful",
  },
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    description: "More powerful model for agent and reasoning work",
    tier: "powerful",
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    description: "Most powerful Claude model available in GPTPRO4ALL",
    tier: "powerful",
  },
  {
    id: "claude-fable-5",
    label: "Claude Fable 5",
    description: "Premium Claude model",
    tier: "premium",
  },
];

export function getModelLabel(modelId: string): string {
  return CLAUDE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

export function isValidModelId(modelId: string): boolean {
  return CLAUDE_MODELS.some((m) => m.id === modelId);
}

export interface OpenAiModelOption {
  id: string;
  label: string;
  description: string;
}

/** Codex/OpenAI-compatible models available through GPTPRO4ALL. */
export const OPENAI_MODELS: OpenAiModelOption[] = [
  {
    id: "gpt-5.5",
    label: "GPT 5.5",
    description: "Default Codex/GPT model in GPTPRO4ALL",
  },
];

export function getOpenAiModelLabel(modelId: string): string {
  return OPENAI_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

export function isValidOpenAiModelId(modelId: string): boolean {
  return OPENAI_MODELS.some((m) => m.id === modelId);
}
