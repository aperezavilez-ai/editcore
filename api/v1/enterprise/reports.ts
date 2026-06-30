import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/enterprise/reports?type=...  — reportes ejecutivos
 * POST /api/v1/enterprise/reports           — generar reporte
 *
 * El POST genera un reporte ejecutivo agregando datos reales de:
 * - factory_projects (proyectos activos)
 * - biz_okrs (progreso de objetivos)
 * - biz_customers (clientes activos)
 * - biz_finance_records (financiero del periodo)
 * - quality_reviews (calidad promedio)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    let q = supabase
      .from("biz_reports")
      .select("id, report_type, period, summary, content, generated_by_agent, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (type) q = q.eq("report_type", type);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los reportes." });
    return res.status(200).json({ reports: data });
  }

  if (req.method === "POST") {
    const { report_type, period, generated_by_agent } = req.body ?? {};
    const rtype = ["daily","weekly","monthly","strategic"].includes(report_type) ? report_type : "daily";
    const rperiod = typeof period === "string" ? period : new Date().toISOString().slice(0, 10);

    // Agregar datos reales
    const [projects, okrs, customers, finance, quality] = await Promise.all([
      supabase.from("factory_projects").select("status").eq("user_id", user.id),
      supabase.from("biz_okrs").select("objective, progress, status").eq("user_id", user.id).eq("status", "active"),
      supabase.from("biz_customers").select("status, contract_value").eq("user_id", user.id),
      supabase.from("biz_finance_records").select("amount_usd_cents, is_revenue").eq("user_id", user.id).eq("period", rperiod.slice(0, 7)),
      supabase.from("quality_reviews").select("overall_score").eq("user_id", user.id),
    ]);

    const projStats = { total: projects.data?.length ?? 0, in_progress: projects.data?.filter(p => p.status === "in_progress").length ?? 0 };
    const revenue = (finance.data ?? []).filter(r => r.is_revenue).reduce((a, r) => a + r.amount_usd_cents, 0);
    const costs = (finance.data ?? []).filter(r => !r.is_revenue).reduce((a, r) => a + r.amount_usd_cents, 0);
    const avgQ = quality.data?.length
      ? Math.round(quality.data.reduce((a, q) => a + q.overall_score, 0) / quality.data.length)
      : 0;
    const activeCustomers = customers.data?.filter(c => c.status === "active").length ?? 0;
    const avgOkrProgress = okrs.data?.length
      ? Math.round(okrs.data.reduce((a, o) => a + o.progress, 0) / okrs.data.length)
      : 0;

    const content = {
      projects: projStats,
      okrs: { active: okrs.data?.length ?? 0, avg_progress: avgOkrProgress },
      customers: { active: activeCustomers },
      finance: { revenue_usd_cents: revenue, costs_usd_cents: costs, net_usd_cents: revenue - costs },
      quality: { avg_score: avgQ, reviews: quality.data?.length ?? 0 },
    };

    const summary = `Reporte ${rtype} — Periodo: ${rperiod}. Proyectos activos: ${projStats.in_progress}/${projStats.total}. OKRs: ${avgOkrProgress}% progreso. Clientes activos: ${activeCustomers}. Calidad: ${avgQ}/100. Net: $${((revenue - costs) / 100).toFixed(2)} USD.`;

    const { data, error } = await supabase
      .from("biz_reports")
      .insert({
        user_id: user.id,
        report_type: rtype,
        period: rperiod,
        summary,
        content,
        generated_by_agent: generated_by_agent ?? "executive-intelligence",
      })
      .select("id, report_type, period, summary, content, created_at")
      .single();

    if (error) return res.status(500).json({ error: "No se pudo generar el reporte." });
    return res.status(201).json({ report: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
