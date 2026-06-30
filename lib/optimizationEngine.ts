import type { ModelTier } from "./modelRouter";

export interface ModelCostBreakdown {
  model: string;
  totalCostUsd: number;
  totalTokens: number;
}

export interface OptimizationProposal {
  title: string;
  description: string;
  level: number;
  impact: string;
}

const MODEL_TIERS: Record<string, ModelTier> = {
  "claude-opus-4-8": "premium",
  "claude-sonnet-4-6": "balanced",
  "claude-haiku-4-5-20251001": "economy",
};

/**
 * Analiza el gasto real por modelo (agregado de usage_events) y, si un
 * modelo premium concentra una porción desproporcionada del costo total,
 * genera una propuesta de revisión de enrutamiento. No cambia nada por sí
 * sola — propuesta Nivel 2 ("proponer"), requiere revisión humana antes
 * de actuar (evolution_proposals.status arranca en 'proposed').
 */
export function analyzeCostOptimization(breakdown: ModelCostBreakdown[]): OptimizationProposal[] {
  const totalCost = breakdown.reduce((sum, m) => sum + m.totalCostUsd, 0);
  if (totalCost <= 0) return [];

  const proposals: OptimizationProposal[] = [];
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
