import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET /api/v1/global/command-center
 *
 * EditCore Global Command Center (Prompt 20, Fase 9).
 * Vista de salud de TODA la plataforma: agrega contadores reales de cada
 * modulo existente (AIOS, Agent Network, Software Factory, Enterprise,
 * Innovation Lab, Digital Enterprise, Evolution Engine) en una sola
 * respuesta. No reemplaza los dashboards de cada modulo (aios/metrics,
 * network/metrics, lab/metrics, dco/metrics, etc.) — los resume.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    orchRuns, agentActivations, modelUsage, evolutionProposals,
    teams, knowledgeNodes, knowledgeEdges,
    factoryProjects,
    ideas, experiments, startups,
    products, leads, supportTickets, governanceDecisions, businessUnits,
    okrs, finance,
  ] = await Promise.all([
    supabase.from("ai_orchestration_runs").select("status").eq("user_id", user.id).gte("created_at", since),
    supabase.from("ai_agent_activations").select("status").eq("user_id", user.id).in("status", ["active", "idle"]),
    supabase.from("ai_model_usage").select("cost_usd_cents").eq("user_id", user.id).gte("created_at", since),
    supabase.from("evolution_proposals").select("status", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("agent_teams").select("status").eq("user_id", user.id),
    supabase.from("knowledge_nodes").select("id", { count: "exact", head: true }).or(`is_public.eq.true,user_id.eq.${user.id}`),
    supabase.from("knowledge_edges").select("id", { count: "exact", head: true }),
    supabase.from("factory_projects").select("status").eq("user_id", user.id),
    supabase.from("lab_ideas").select("status").eq("user_id", user.id),
    supabase.from("lab_experiments").select("status").eq("user_id", user.id),
    supabase.from("lab_startups").select("status").eq("user_id", user.id),
    supabase.from("dco_products").select("status, mrr_usd_cents").eq("user_id", user.id),
    supabase.from("dco_leads").select("estimated_value_usd_cents, probability").eq("user_id", user.id),
    supabase.from("dco_support_tickets").select("status, priority").eq("user_id", user.id),
    supabase.from("dco_governance_decisions").select("status").eq("user_id", user.id),
    supabase.from("dco_business_units").select("status").eq("user_id", user.id),
    supabase.from("biz_okrs").select("progress").eq("user_id", user.id).eq("status", "active"),
    supabase.from("biz_finance_records").select("amount_usd_cents, is_revenue").eq("user_id", user.id),
  ]);

  const modelCost24h = (modelUsage.data ?? []).reduce((a, m) => a + (m.cost_usd_cents ?? 0), 0);
  const revenue = (finance.data ?? []).filter(r => r.is_revenue).reduce((a, r) => a + r.amount_usd_cents, 0);
  const costs = (finance.data ?? []).filter(r => !r.is_revenue).reduce((a, r) => a + r.amount_usd_cents, 0);
  const pipeline = (leads.data ?? []).reduce((a, l) => a + Math.round(l.estimated_value_usd_cents * l.probability / 100), 0);
  const avgOkr = okrs.data?.length ? Math.round(okrs.data.reduce((a, o) => a + o.progress, 0) / okrs.data.length) : 0;

  return res.status(200).json({
    period: "last_24h",
    intelligence: {
      orchestration_runs_24h: (orchRuns.data ?? []).length,
      agents_active: (agentActivations.data ?? []).filter(a => a.status === "active").length,
      agents_idle: (agentActivations.data ?? []).filter(a => a.status === "idle").length,
      model_cost_usd_cents_24h: modelCost24h,
      open_evolution_proposals: evolutionProposals.count ?? 0,
    },
    network: {
      teams_total: (teams.data ?? []).length,
      teams_active: (teams.data ?? []).filter(t => t.status === "active").length,
      knowledge_nodes: knowledgeNodes.count ?? 0,
      knowledge_edges: knowledgeEdges.count ?? 0,
    },
    software_factory: {
      projects_total: (factoryProjects.data ?? []).length,
      projects_in_progress: (factoryProjects.data ?? []).filter(p => p.status === "in_progress").length,
    },
    innovation_lab: {
      ideas_total: (ideas.data ?? []).length,
      ideas_validated: (ideas.data ?? []).filter(i => i.status === "validated").length,
      experiments_running: (experiments.data ?? []).filter(e => e.status === "running").length,
      startups_launched: (startups.data ?? []).filter(s => s.status === "launched").length,
    },
    digital_enterprise: {
      products_active: (products.data ?? []).filter(p => p.status === "active").length,
      total_mrr_usd_cents: (products.data ?? []).reduce((a, p) => a + p.mrr_usd_cents, 0),
      pipeline_usd_cents: pipeline,
      support_open: (supportTickets.data ?? []).filter(t => t.status === "open").length,
      support_critical: (supportTickets.data ?? []).filter(t => t.priority === "critical").length,
      governance_pending: (governanceDecisions.data ?? []).filter(d => d.status === "pending").length,
      business_units_total: (businessUnits.data ?? []).length,
    },
    finance: {
      net_revenue_usd_cents: revenue - costs,
      avg_okr_progress: avgOkr,
    },
  });
}
