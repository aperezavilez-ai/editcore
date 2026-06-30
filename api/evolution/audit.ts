import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { analyzeCostOptimization, type ModelCostBreakdown } from "../../lib/optimizationEngine";

/**
 * GET /api/evolution/audit?kind=daily|weekly|monthly
 *
 * Auditoría real (Prompt 12, Fase 2): cuenta recursos reales del sistema
 * (no simulados) y guarda el resultado en evolution_audits. Pensado para
 * ser invocado por Vercel Cron (ver vercel.json). Protegido con
 * CRON_SECRET para que no cualquiera pueda dispararlo ni inflar métricas.
 *
 * Deliberadamente NO genera código ni decide cambios por sí mismo — solo
 * mide. Las propuestas de mejora "manuales" se crean por separado en
 * evolution_proposals (ver /api/evolution/proposals), revisadas por un
 * humano (Fase 14: seguridad de automejora).
 *
 * P4.2 — Optimization Engine: en auditorías 'weekly', además analiza el
 * gasto real por modelo en usage_events (no simulado) y, si corresponde,
 * registra una propuesta Nivel 2 (solo "proponer", nunca autoejecuta) en
 * evolution_proposals con source='audit'. Deduplica por título contra
 * propuestas ya 'proposed' para no spamear la tabla cada semana.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const kind = (req.query.kind as string) || "daily";
  if (!["daily", "weekly", "monthly"].includes(kind)) {
    return res.status(400).json({ error: "kind debe ser daily, weekly o monthly." });
  }

  const supabase = getSupabaseAdmin();

  const [organizations, profiles, developerKeys, agents, posts, comments, proposals] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("developer_api_keys").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("agent_definitions").select("id", { count: "exact", head: true }),
    supabase.from("community_posts").select("id", { count: "exact", head: true }),
    supabase.from("community_comments").select("id", { count: "exact", head: true }),
    supabase.from("evolution_proposals").select("id", { count: "exact", head: true }).eq("status", "proposed"),
  ]);

  let costOptimizationProposalsCreated = 0;
  if (kind === "weekly") {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: usageEvents } = await supabase
      .from("usage_events")
      .select("model, input_tokens, output_tokens, estimated_cost_usd")
      .gte("created_at", since.toISOString());

    const byModel = new Map<string, { totalCostUsd: number; totalTokens: number }>();
    for (const event of usageEvents ?? []) {
      const entry = byModel.get(event.model) ?? { totalCostUsd: 0, totalTokens: 0 };
      entry.totalCostUsd += Number(event.estimated_cost_usd ?? 0);
      entry.totalTokens += Number(event.input_tokens ?? 0) + Number(event.output_tokens ?? 0);
      byModel.set(event.model, entry);
    }
    const breakdown: ModelCostBreakdown[] = Array.from(byModel.entries()).map(([model, v]) => ({
      model,
      ...v,
    }));

    const costProposals = analyzeCostOptimization(breakdown);
    for (const proposal of costProposals) {
      const { data: existing } = await supabase
        .from("evolution_proposals")
        .select("id")
        .eq("title", proposal.title)
        .eq("status", "proposed")
        .maybeSingle();
      if (existing) continue;

      const { error: insertError } = await supabase.from("evolution_proposals").insert({
        title: proposal.title,
        description: proposal.description,
        level: proposal.level,
        impact: proposal.impact,
        source: "audit",
      });
      if (!insertError) costOptimizationProposalsCreated += 1;
    }
  }

  const metrics = {
    organizations: organizations.count ?? 0,
    users: profiles.count ?? 0,
    active_developer_keys: developerKeys.count ?? 0,
    public_and_private_agents: agents.count ?? 0,
    community_posts: posts.count ?? 0,
    community_comments: comments.count ?? 0,
    open_proposals: proposals.count ?? 0,
    cost_optimization_proposals_created: costOptimizationProposalsCreated,
    measured_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("evolution_audits")
    .insert({ kind, metrics })
    .select("id, kind, metrics, created_at")
    .single();
  if (error) return res.status(500).json({ error: "No se pudo guardar la auditoría." });

  return res.status(200).json({ audit: data });
}
