/**
 * AI Model Router — selecciona el modelo óptimo según tipo de tarea,
 * balance costo/calidad y nivel de complejidad.
 *
 * No realiza llamadas a la API de IA directamente; devuelve la
 * recomendación para que el caller elija qué modelo usar.
 */

export type TaskType =
  | "architecture"
  | "code_generation"
  | "code_review"
  | "security_analysis"
  | "test_generation"
  | "planning"
  | "documentation"
  | "summarization"
  | "simple_qa"
  | "data_analysis"
  | "debugging";

export type ModelTier = "economy" | "balanced" | "premium";

export interface ModelRecommendation {
  model_id: string;
  provider: "anthropic" | "openai";
  tier: ModelTier;
  task_type: TaskType;
  rationale: string;
  estimated_cost_per_1k_tokens_usd: number;
  max_context_tokens: number;
}

const MODEL_CATALOG: Record<string, Omit<ModelRecommendation, "task_type" | "rationale">> = {
  "claude-opus-4-8": {
    model_id: "claude-opus-4-8",
    provider: "anthropic",
    tier: "premium",
    estimated_cost_per_1k_tokens_usd: 0.015,
    max_context_tokens: 200000,
  },
  "claude-sonnet-4-6": {
    model_id: "claude-sonnet-4-6",
    provider: "anthropic",
    tier: "balanced",
    estimated_cost_per_1k_tokens_usd: 0.003,
    max_context_tokens: 200000,
  },
  "claude-haiku-4-5-20251001": {
    model_id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    tier: "economy",
    estimated_cost_per_1k_tokens_usd: 0.00025,
    max_context_tokens: 200000,
  },
};

const TASK_ROUTING: Record<
  TaskType,
  { model_id: string; rationale: string }
> = {
  architecture:      { model_id: "claude-opus-4-8",            rationale: "Diseño de arquitectura requiere razonamiento profundo y visión sistémica." },
  security_analysis: { model_id: "claude-opus-4-8",            rationale: "Seguridad exige análisis exhaustivo sin atajos." },
  code_generation:   { model_id: "claude-sonnet-4-6",          rationale: "Generación de código: balance óptimo calidad/costo." },
  code_review:       { model_id: "claude-sonnet-4-6",          rationale: "Revisión de código: profundidad suficiente sin costo premium." },
  debugging:         { model_id: "claude-sonnet-4-6",          rationale: "Debugging requiere contexto amplio y razonamiento intermedio." },
  test_generation:   { model_id: "claude-sonnet-4-6",          rationale: "Tests: calidad media, volumen alto." },
  planning:          { model_id: "claude-sonnet-4-6",          rationale: "Planificación: contexto largo, razonamiento estructurado." },
  data_analysis:     { model_id: "claude-sonnet-4-6",          rationale: "Análisis de datos: precisión sobre economía." },
  documentation:     { model_id: "claude-haiku-4-5-20251001",  rationale: "Documentación: tarea estructurada, modelo económico suficiente." },
  summarization:     { model_id: "claude-haiku-4-5-20251001",  rationale: "Resúmenes: alta velocidad, bajo costo." },
  simple_qa:         { model_id: "claude-haiku-4-5-20251001",  rationale: "Q&A simple: latencia mínima y costo mínimo." },
};

export function routeModel(taskType: TaskType): ModelRecommendation {
  const route = TASK_ROUTING[taskType];
  const catalog = MODEL_CATALOG[route.model_id];
  return { ...catalog, task_type: taskType, rationale: route.rationale };
}

export function routeByComplexity(
  taskType: TaskType,
  complexityScore: number
): ModelRecommendation {
  // complexityScore 1-10: < 4 → economy, 4-7 → balanced, > 7 → premium
  if (complexityScore <= 3) {
    const catalog = MODEL_CATALOG["claude-haiku-4-5-20251001"];
    return { ...catalog, task_type: taskType, rationale: `Complejidad baja (${complexityScore}/10): modelo económico suficiente.` };
  }
  if (complexityScore <= 7) {
    const base = routeModel(taskType);
    if (base.tier === "premium") {
      const catalog = MODEL_CATALOG["claude-sonnet-4-6"];
      return { ...catalog, task_type: taskType, rationale: `Complejidad media (${complexityScore}/10): downgrade a balanced para optimizar costo.` };
    }
    return base;
  }
  const catalog = MODEL_CATALOG["claude-opus-4-8"];
  return { ...catalog, task_type: taskType, rationale: `Complejidad alta (${complexityScore}/10): modelo premium requerido.` };
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = MODEL_CATALOG[modelId];
  if (!model) return 0;
  return Math.ceil((inputTokens + outputTokens) * model.estimated_cost_per_1k_tokens_usd);
}
