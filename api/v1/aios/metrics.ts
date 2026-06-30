import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET /api/v1/aios/metrics
 * Métricas en tiempo real para el AI Command Center.
 * Requiere sesión Bearer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [runs, agents, modelUsage, metaLearning, evolution, factory] = await Promise.all([
    supabase.from("ai_orchestration_runs")
      .select("status", { count: "exact", head: false })
      .eq("user_id", user.id)
      .gte("created_at", since),

    supabase.from("ai_agent_activations")
      .select("agent_slug, status")
      .eq("user_id", user.id)
      .in("status", ["active", "idle"]),

    supabase.from("ai_model_usage")
      .select("model_id, tokens_input, tokens_output, cost_usd_cents, success")
      .eq("user_id", user.id)
      .gte("created_at", since),

    supabase.from("ai_meta_learning")
      .select("event_type", { count: "exact", head: false })
      .gte("created_at", since),

    supabase.from("evolution_proposals")
      .select("status", { count: "exact", head: false })
      .eq("status", "open"),

    supabase.from("factory_projects")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["in_progress", "testing", "deploying"]),
  ]);

  const runStats = { total: 0, planning: 0, running: 0, completed: 0, failed: 0 };
  for (const r of runs.data ?? []) {
    runStats.total++;
    if (r.status in runStats) (runStats as Record<string, number>)[r.status]++;
  }

  const modelStats: Record<string, { calls: number; cost_usd_cents: number; errors: number }> = {};
  for (const m of modelUsage.data ?? []) {
    if (!modelStats[m.model_id]) modelStats[m.model_id] = { calls: 0, cost_usd_cents: 0, errors: 0 };
    modelStats[m.model_id].calls++;
    modelStats[m.model_id].cost_usd_cents += m.cost_usd_cents ?? 0;
    if (!m.success) modelStats[m.model_id].errors++;
  }

  const totalCost = Object.values(modelStats).reduce((acc, m) => acc + m.cost_usd_cents, 0);

  const learningCounts = { success: 0, failure: 0, correction: 0, insight: 0 };
  for (const l of (metaLearning.data as { event_type: string }[] | null) ?? []) {
    if (l.event_type in learningCounts) (learningCounts as Record<string, number>)[l.event_type]++;
  }

  return res.status(200).json({
    period: "last_24h",
    orchestration: runStats,
    agents: {
      active: (agents.data ?? []).filter(a => a.status === "active").length,
      idle: (agents.data ?? []).filter(a => a.status === "idle").length,
      list: agents.data ?? [],
    },
    models: {
      by_model: modelStats,
      total_cost_usd_cents: totalCost,
    },
    meta_learning: learningCounts,
    open_proposals: evolution.count ?? 0,
    active_factory_projects: (factory.data ?? []).length,
  });
}
