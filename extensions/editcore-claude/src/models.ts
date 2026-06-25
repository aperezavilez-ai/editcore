export interface ClaudeModelOption {
  id: string;
  label: string;
  description: string;
  tier: "balanced" | "powerful" | "premium";
}

/** Modelos Claude disponibles via API de Anthropic. */
export const CLAUDE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    description: "Modelo equilibrado: rápido y de alta calidad",
    tier: "balanced",
  },
  {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    description: "Modelo más potente para tareas complejas",
    tier: "powerful",
  },
  {
    id: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet",
    description: "Versión estable y versátil",
    tier: "balanced",
  },
  {
    id: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku",
    description: "Modelo ligero y económico",
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

/** Modelos OpenAI disponibles via API oficial. */
export const OPENAI_MODELS: OpenAiModelOption[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "Modelo OpenAI por defecto: rápido y capaz",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    description: "Modelo ligero y económico",
  },
];

export function getOpenAiModelLabel(modelId: string): string {
  return OPENAI_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

export function isValidOpenAiModelId(modelId: string): boolean {
  return OPENAI_MODELS.some((m) => m.id === modelId);
}
