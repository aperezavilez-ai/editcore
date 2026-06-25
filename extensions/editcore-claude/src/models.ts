export interface ClaudeModelOption {
  id: string;
  label: string;
  description: string;
  tier: "balanced" | "powerful" | "fast";
}

/** Modelos Claude verificados en la API de Anthropic (Messages API). */
export const CLAUDE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    description: "Por defecto: equilibrado para código y agente",
    tier: "balanced",
  },
  {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    description: "Máxima capacidad para tareas complejas",
    tier: "powerful",
  },
  {
    id: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku",
    description: "Rápido y económico",
    tier: "fast",
  },
];

/** Modelos retirados: migrar al sustituto en settings. */
export const DEPRECATED_CLAUDE_MODELS: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-20250514",
};

export function getModelLabel(modelId: string): string {
  return CLAUDE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

export function isValidModelId(modelId: string): boolean {
  return CLAUDE_MODELS.some((m) => m.id === modelId);
}

export function resolveClaudeModelId(modelId: string): string {
  return DEPRECATED_CLAUDE_MODELS[modelId] ?? modelId;
}

export interface OpenAiModelOption {
  id: string;
  label: string;
  description: string;
}

/** Modelos OpenAI verificados en Chat Completions API. */
export const OPENAI_MODELS: OpenAiModelOption[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "OpenAI por defecto: código y chat general",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    description: "Ligero y económico",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    description: "Más reciente; mejor en instrucciones largas",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    description: "GPT-4.1 compacto y rápido",
  },
];

export function getOpenAiModelLabel(modelId: string): string {
  return OPENAI_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

export function isValidOpenAiModelId(modelId: string): boolean {
  return OPENAI_MODELS.some((m) => m.id === modelId);
}

export function isOpenAiModelId(modelId: string): boolean {
  return isValidOpenAiModelId(modelId);
}
