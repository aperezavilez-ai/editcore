export interface ClaudeModelOption {
  id: string;
  label: string;
  description: string;
  tier: "balanced" | "powerful" | "fast";
}

/** Modelos Claude actuales (Messages API, 2026). */
export const CLAUDE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Por defecto: equilibrado para código y agente",
    tier: "balanced",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    description: "Máxima capacidad para tareas complejas",
    tier: "powerful",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Rápido y económico",
    tier: "fast",
  },
];

/** Modelos retirados: migrar al sustituto en settings al arrancar. */
export const DEPRECATED_CLAUDE_MODELS: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-6",
  "claude-3-7-sonnet-20250219": "claude-sonnet-4-6",
  "claude-sonnet-4": "claude-sonnet-4-6",
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-opus-4": "claude-opus-4-6",
  "claude-opus-4-20250514": "claude-opus-4-6",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5",
};

/** Snapshots retirados por Anthropic (jun 2026); cualquier ID que los contenga se remapea. */
const RETIRED_MODEL_SNIPPETS: Array<{ match: RegExp; replacement: string }> = [
  { match: /sonnet-4-20250514/i, replacement: "claude-sonnet-4-6" },
  { match: /opus-4-20250514/i, replacement: "claude-opus-4-6" },
  { match: /3-7-sonnet-20250219/i, replacement: "claude-sonnet-4-6" },
  { match: /3-5-sonnet-20241022/i, replacement: "claude-sonnet-4-6" },
];

export function getModelLabel(modelId: string): string {
  return CLAUDE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

export function isValidModelId(modelId: string): boolean {
  return CLAUDE_MODELS.some((m) => m.id === modelId);
}

export function resolveClaudeModelId(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) {
    return CLAUDE_MODELS[0].id;
  }

  const direct = DEPRECATED_CLAUDE_MODELS[trimmed] ?? trimmed;
  if (isValidModelId(direct)) {
    return direct;
  }

  for (const { match, replacement } of RETIRED_MODEL_SNIPPETS) {
    if (match.test(trimmed)) {
      return replacement;
    }
  }

  return CLAUDE_MODELS[0].id;
}

/** Lee editcore.model y devuelve un ID válido para la API. */
export function resolveClaudeModelFromSettings(raw?: string): string {
  return resolveClaudeModelId(raw ?? CLAUDE_MODELS[0].id);
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
