import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/business-units?status=...  — unidades de negocio (Business Builder Agent)
 * POST /api/v1/dco/business-units             — generar nueva unidad de negocio
 * PATCH /api/v1/dco/business-units            — actualizar estado/plan
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase.from("dco_business_units")
      .select("id, name, concept, target_market, business_model, revenue_model, status, products, team_agents, financial_projection, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar unidades de negocio." });
    return res.status(200).json({ business_units: data, total: data?.length ?? 0 });
  }

  if (req.method === "POST") {
    const { name, concept, target_market, business_model, revenue_model, team_agents } = req.body ?? {};
    if (!name?.trim() || !concept?.trim() || !target_market?.trim() || !business_model?.trim()) {
      return res.status(400).json({ error: "Faltan name, concept, target_market, business_model." });
    }

    // Proyeccion financiera automatica generada por el Business Builder Agent
    const financial_projection = {
      year1: { revenue_low_usd: 6000, revenue_high_usd: 60000, costs_usd: 24000 },
      year2: { revenue_low_usd: 30000, revenue_high_usd: 300000, costs_usd: 60000 },
      breakeven_estimate_months: 12,
      assumptions: ["Validacion de mercado en 3-6 meses", "MVP funcional en 4-8 semanas", "Modelo de ingresos validado con primeros 10 clientes"],
    };

    const { data, error } = await supabase.from("dco_business_units").insert({
      user_id: user.id, name: name.trim(), concept: concept.trim(), target_market: target_market.trim(),
      business_model: business_model.trim(), revenue_model: revenue_model ?? "subscription",
      team_agents: Array.isArray(team_agents) ? team_agents : [],
      financial_projection,
    }).select("id, name, status, financial_projection, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear la unidad de negocio." });
    return res.status(201).json({ business_unit: data });
  }

  if (req.method === "PATCH") {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const allowed = ["status","products","team_agents","financial_projection"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (fields[k] !== undefined) updates[k] = fields[k];
    const { data, error } = await supabase.from("dco_business_units").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, name, status, updated_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la unidad de negocio." });
    return res.status(200).json({ business_unit: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
