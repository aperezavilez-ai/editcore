import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/executive          — ultimo snapshot ejecutivo
 * POST /api/v1/dco/executive          — generar nuevo snapshot del CEO Intelligence Agent
 *
 * El POST agrega datos reales de todos los sistemas para generar el reporte ejecutivo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase.from("dco_executive_snapshots")
      .select("id, snapshot_date, summary, opportunities, risks, recommendations, kpis, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
    if (error) return res.status(500).json({ error: "No se pudo listar snapshots." });
    return res.status(200).json({ snapshots: data });
  }

  if (req.method === "POST") {
    // Agregar datos reales de todos los sistemas
    const [products, leads, tickets, campaigns, growth, governance, okrs, finance, projects] = await Promise.all([
      supabase.from("dco_products").select("status, mrr_usd_cents, active_users").eq("user_id", user.id),
      supabase.from("dco_leads").select("status, estimated_value_usd_cents, probability").eq("user_id", user.id),
      supabase.from("dco_support_tickets").select("status, priority").eq("user_id", user.id),
      supabase.from("dco_campaigns").select("status, budget_usd_cents, spent_usd_cents").eq("user_id", user.id),
      supabase.from("dco_growth_initiatives").select("status, estimated_impact").eq("user_id", user.id),
      supabase.from("dco_governance_decisions").select("status, risk_level").eq("user_id", user.id),
      supabase.from("biz_okrs").select("status, progress").eq("user_id", user.id).eq("status", "active"),
      supabase.from("biz_finance_records").select("amount_usd_cents, is_revenue").eq("user_id", user.id),
      supabase.from("factory_projects").select("status").eq("user_id", user.id),
    ]);

    const prods = products.data ?? [];
    const ldata = leads.data ?? [];
    const tdata = tickets.data ?? [];
    const totalMrr = prods.reduce((a, p) => a + p.mrr_usd_cents, 0);
    const totalUsers = prods.reduce((a, p) => a + p.active_users, 0);
    const pipeline = ldata.reduce((a, l) => a + Math.round(l.estimated_value_usd_cents * l.probability / 100), 0);
    const revenue = (finance.data ?? []).filter(r => r.is_revenue).reduce((a, r) => a + r.amount_usd_cents, 0);
    const costs = (finance.data ?? []).filter(r => !r.is_revenue).reduce((a, r) => a + r.amount_usd_cents, 0);
    const avgOkr = okrs.data?.length ? Math.round(okrs.data.reduce((a, o) => a + o.progress, 0) / okrs.data.length) : 0;
    const openTickets = tdata.filter(t => t.status === "open").length;
    const criticalTickets = tdata.filter(t => t.priority === "critical").length;
    const pendingGovernance = (governance.data ?? []).filter(d => d.status === "pending").length;
    const activeGrowth = (growth.data ?? []).filter(g => g.status === "active").length;

    const kpis = {
      total_mrr_usd_cents: totalMrr,
      total_active_users: totalUsers,
      pipeline_usd_cents: pipeline,
      net_revenue_usd_cents: revenue - costs,
      avg_okr_progress: avgOkr,
      open_tickets: openTickets,
      active_products: prods.filter(p => p.status === "active").length,
      active_campaigns: (campaigns.data ?? []).filter(c => c.status === "active").length,
      active_growth_initiatives: activeGrowth,
      pending_governance_decisions: pendingGovernance,
      active_projects: (projects.data ?? []).filter(p => p.status === "in_progress").length,
    };

    const opportunities: string[] = [];
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (pipeline > 0) opportunities.push(`Pipeline de ventas activo: $${(pipeline / 100).toFixed(2)} USD ponderado.`);
    if (activeGrowth > 0) opportunities.push(`${activeGrowth} iniciativas de crecimiento activas en ejecucion.`);
    if (avgOkr >= 70) opportunities.push(`OKRs en buen ritmo (${avgOkr}% progreso promedio).`);

    if (criticalTickets > 0) risks.push(`${criticalTickets} tickets criticos de soporte sin resolver.`);
    if (pendingGovernance > 0) risks.push(`${pendingGovernance} decisiones de gobernanza pendientes de aprobacion humana.`);
    if (revenue - costs < 0) risks.push(`Resultado neto negativo: $${((revenue - costs) / 100).toFixed(2)} USD.`);
    if (openTickets > 10) risks.push(`Alta carga de soporte: ${openTickets} tickets abiertos.`);

    if (totalMrr === 0) recommendations.push("Priorizar la activacion de revenue en productos activos.");
    if (avgOkr < 50) recommendations.push("Revisar OKRs con progreso bajo — considerar replantear metas o agregar recursos.");
    if (pendingGovernance > 2) recommendations.push("Resolver decisiones de gobernanza pendientes antes de avanzar con cambios criticos.");
    recommendations.push("Generar reporte ejecutivo semanal y alinear equipo con OKRs del periodo.");

    const summary = `Snapshot ejecutivo ${new Date().toLocaleDateString("es")}. MRR: $${(totalMrr / 100).toFixed(2)} USD. Usuarios activos: ${totalUsers}. Pipeline: $${(pipeline / 100).toFixed(2)} USD. OKRs: ${avgOkr}%. Tickets abiertos: ${openTickets}${criticalTickets > 0 ? ` (${criticalTickets} criticos)` : ""}. Proyectos activos: ${kpis.active_projects}.`;

    const { data, error } = await supabase.from("dco_executive_snapshots").insert({
      user_id: user.id, summary, opportunities, risks, recommendations, kpis,
    }).select("id, snapshot_date, summary, opportunities, risks, recommendations, kpis, created_at").single();

    if (error) return res.status(500).json({ error: "No se pudo generar el snapshot ejecutivo." });
    return res.status(201).json({ snapshot: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
