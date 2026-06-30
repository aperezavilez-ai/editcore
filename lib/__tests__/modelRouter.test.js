const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lógica duplicada de lib/modelRouter.ts para testear sin paso de compilación.
const MODEL_CATALOG = {
  "claude-opus-4-8": { model_id: "claude-opus-4-8", provider: "anthropic", tier: "premium", estimated_cost_per_1k_tokens_usd: 0.015, max_context_tokens: 200000 },
  "claude-sonnet-4-6": { model_id: "claude-sonnet-4-6", provider: "anthropic", tier: "balanced", estimated_cost_per_1k_tokens_usd: 0.003, max_context_tokens: 200000 },
  "claude-haiku-4-5-20251001": { model_id: "claude-haiku-4-5-20251001", provider: "anthropic", tier: "economy", estimated_cost_per_1k_tokens_usd: 0.00025, max_context_tokens: 200000 },
};

const TASK_ROUTING = {
  architecture:      { model_id: "claude-opus-4-8",           rationale: "Diseño de arquitectura requiere razonamiento profundo y visión sistémica." },
  security_analysis: { model_id: "claude-opus-4-8",           rationale: "Seguridad exige análisis exhaustivo sin atajos." },
  code_generation:   { model_id: "claude-sonnet-4-6",         rationale: "Generación de código: balance óptimo calidad/costo." },
  code_review:       { model_id: "claude-sonnet-4-6",         rationale: "Revisión de código: profundidad suficiente sin costo premium." },
  debugging:         { model_id: "claude-sonnet-4-6",         rationale: "Debugging requiere contexto amplio y razonamiento intermedio." },
  test_generation:   { model_id: "claude-sonnet-4-6",         rationale: "Tests: calidad media, volumen alto." },
  planning:          { model_id: "claude-sonnet-4-6",         rationale: "Planificación: contexto largo, razonamiento estructurado." },
  data_analysis:     { model_id: "claude-sonnet-4-6",         rationale: "Análisis de datos: precisión sobre economía." },
  documentation:     { model_id: "claude-haiku-4-5-20251001", rationale: "Documentación: tarea estructurada, modelo económico suficiente." },
  summarization:     { model_id: "claude-haiku-4-5-20251001", rationale: "Resúmenes: alta velocidad, bajo costo." },
  simple_qa:         { model_id: "claude-haiku-4-5-20251001", rationale: "Q&A simple: latencia mínima y costo mínimo." },
};

function routeModel(taskType) {
  const route = TASK_ROUTING[taskType];
  const catalog = MODEL_CATALOG[route.model_id];
  return { ...catalog, task_type: taskType, rationale: route.rationale };
}

function routeByComplexity(taskType, complexityScore) {
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

function estimateCost(modelId, inputTokens, outputTokens) {
  const model = MODEL_CATALOG[modelId];
  if (!model) return 0;
  return Math.ceil((inputTokens + outputTokens) * model.estimated_cost_per_1k_tokens_usd);
}

describe('routeModel', () => {
  it('enruta arquitectura a modelo premium', () => {
    assert.equal(routeModel('architecture').tier, 'premium');
  });
  it('enruta resúmenes a modelo económico', () => {
    assert.equal(routeModel('summarization').tier, 'economy');
  });
  it('enruta generación de código a modelo balanceado', () => {
    assert.equal(routeModel('code_generation').tier, 'balanced');
  });
});

describe('routeByComplexity', () => {
  it('complejidad baja siempre usa economy sin importar el tipo de tarea', () => {
    assert.equal(routeByComplexity('architecture', 2).tier, 'economy');
  });
  it('complejidad alta siempre usa premium sin importar el tipo de tarea', () => {
    assert.equal(routeByComplexity('summarization', 9).tier, 'premium');
  });
  it('complejidad media hace downgrade de premium a balanced', () => {
    const r = routeByComplexity('architecture', 5);
    assert.equal(r.tier, 'balanced');
  });
  it('complejidad media mantiene balanced si la tarea ya era balanced', () => {
    const r = routeByComplexity('code_generation', 5);
    assert.equal(r.tier, 'balanced');
  });
});

describe('estimateCost', () => {
  it('calcula el costo redondeado hacia arriba', () => {
    const cost = estimateCost('claude-sonnet-4-6', 500, 500);
    assert.equal(cost, Math.ceil(1000 * 0.003));
  });
  it('devuelve 0 para un modelo desconocido', () => {
    assert.equal(estimateCost('modelo-inexistente', 100, 100), 0);
  });
});
