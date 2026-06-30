import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET /api/v1/dco/metrics — metricas del Digital Command Center
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  const [products, leads, tickets, campaigns, growth, governance, bizUnits] = await Promise.all([
    supabase.from("dco_products").select("status, mrr_usd_cents, active_users").eq("user_id", user.id),
    supabase.from("dco_leads").select("status, estimated_value_usd_cents, probability").eq("user_id", user.id),
    supabase.from("dco_support_tickets").select("status, priority").eq("user_id", user.id),
    supabase.from("dco_campaigns").select("status").eq("user_id", user.id),
    supabase.from("dco_growth_initiatives").select("status, estimated_impact").eq("user_id", user.id),
    supabase.from("dco_governance_decisions").select("status").eq("user_id", user.id),
    supabase.from("dco_business_units").select("status").eq("user_id", user.id),
  ]);

  const prods = products.data ?? [];
  const ldata = leads.data ?? [];
  const tdata = tickets.data ?? [];

  return res.status(200).json({
    products: { total: prods.length, active: prods.filter(p => p.status === "active").length, total_mrr: prods.reduce((a, p) => a + p.mrr_usd_cents, 0), total_users: prods.reduce((a, p) => a + p.active_users, 0) },
    leads: { total: ldata.length, won: ldata.filter(l => l.status === "won").length, pipeline: ldata.reduce((a, l) => a + Math.round(l.estimated_value_usd_cents * l.probability / 100), 0) },
    support: { total: tdata.length, open: tdata.filter(t => t.status === "open").length, critical: tdata.filter(t => t.priority === "critical").length },
    campaigns: { total: campaigns.data?.length ?? 0, active: campaigns.data?.filter(c => c.status === "active").length ?? 0 },
    growth: { total: growth.data?.length ?? 0, active: growth.data?.filter(g => g.status === "active").length ?? 0 },
    governance: { total: governance.data?.length ?? 0, pending: governance.data?.filter(d => d.status === "pending").length ?? 0 },
    business_units: { total: bizUnits.data?.length ?? 0, launched: bizUnits.data?.filter(b => b.status === "launched").length ?? 0 },
  });
}
