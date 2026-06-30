const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lógica duplicada de lib/optimizationEngine.ts para testear sin paso de compilación.
const MODEL_TIERS = {
  "claude-opus-4-8": "premium",
  "claude-sonnet-4-6": "balanced",
  "claude-haiku-4-5-20251001": "economy",
};

function analyzeCostOptimization(breakdown) {
  const totalCost = breakdown.reduce((sum, m) => sum + m.totalCostUsd, 0);
  if (totalCost <= 0) return [];

  const proposals = [];
  for (const entry of breakdown) {
    const tier = MODEL_TIERS[entry.model] ?? "balanced";
    if (tier !== "premium") continue;

    const share = entry.totalCostUsd / totalCost;
    if (share >= 0.5 && totalCost >= 1) {
      const pct = (share * 100).toFixed(1);
      proposals.push({
        title: `Revisar uso de ${entry.model} (${pct}% del gasto en IA)`,
        description: `En el período analizado, ${entry.model} (tier premium) representó $${entry.totalCostUsd.toFixed(2)} de $${totalCost.toFixed(2)} de costo total en IA (${pct}%), sobre ${entry.totalTokens.toLocaleString("es")} tokens consumidos. Revisar si parte de ese tráfico puede enrutarse a un modelo balanced o economy (ver lib/modelRouter.ts) sin pérdida de calidad perceptible.`,
        level: 2,
        impact: "cost",
      });
    }
  }
  return proposals;
}

describe('analyzeCostOptimization', () => {
  it('no propone nada si no hay costo registrado', () => {
    assert.deepEqual(analyzeCostOptimization([]), []);
  });

  it('no propone nada si el gasto total es menor a $1', () => {
    const result = analyzeCostOptimization([
      { model: 'claude-opus-4-8', totalCostUsd: 0.5, totalTokens: 1000 },
    ]);
    assert.deepEqual(result, []);
  });

  it('no propone nada si ningún modelo premium concentra >=50% del gasto', () => {
    const result = analyzeCostOptimization([
      { model: 'claude-opus-4-8', totalCostUsd: 3, totalTokens: 1000 },
      { model: 'claude-sonnet-4-6', totalCostUsd: 10, totalTokens: 5000 },
    ]);
    assert.deepEqual(result, []);
  });

  it('no propone nada si el modelo dominante no es premium', () => {
    const result = analyzeCostOptimization([
      { model: 'claude-sonnet-4-6', totalCostUsd: 8, totalTokens: 5000 },
      { model: 'claude-haiku-4-5-20251001', totalCostUsd: 1, totalTokens: 1000 },
    ]);
    assert.deepEqual(result, []);
  });

  it('propone revisar un modelo premium que concentra >=50% del gasto', () => {
    const result = analyzeCostOptimization([
      { model: 'claude-opus-4-8', totalCostUsd: 7, totalTokens: 2000 },
      { model: 'claude-sonnet-4-6', totalCostUsd: 3, totalTokens: 4000 },
    ]);
    assert.equal(result.length, 1);
    assert.match(result[0].title, /claude-opus-4-8/);
    assert.match(result[0].title, /70\.0%/);
    assert.equal(result[0].level, 2);
    assert.equal(result[0].impact, 'cost');
  });
});
