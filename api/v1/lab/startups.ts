import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/startups?status=...  — startups internas
 * POST /api/v1/lab/startups             — crear startup interna
 * PATCH /api/v1/lab/startups            — actualizar startup
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase
      .from("lab_startups")
      .select("id, idea_id, name, tagline, concept, target_market, business_model, revenue_streams, architecture, mvp_plan, simulation, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar las startups." });
    return res.status(200).json({ startups: data });
  }

  if (req.method === "POST") {
    const { idea_id, name, tagline, concept, target_market, business_model, revenue_streams, architecture, mvp_plan } = req.body ?? {};
    if (!name?.trim() || !concept?.trim() || !target_market?.trim() || !business_model?.trim()) {
      return res.status(400).json({ error: "Faltan campos: name, concept, target_market, business_model." });
    }

    // Simulacion automatica de negocio basada en inputs
    const simulation = {
      year1: {
        users_low: 100,
        users_high: 1000,
        mrr_low_usd: 500,
        mrr_high_usd: 10000,
        burn_rate_usd: 5000,
      },
      year2: {
        users_low: 1000,
        users_high: 10000,
        mrr_low_usd: 5000,
        mrr_high_usd: 100000,
        burn_rate_usd: 15000,
      },
      assumptions: ["Product-market fit en 6-12 meses", "CAC < LTV x3", "Retention > 60% mensual"],
    };

    const { data, error } = await supabase
      .from("lab_startups")
      .insert({
        user_id: user.id,
        idea_id: typeof idea_id === "string" ? idea_id : null,
        name: name.trim(),
        tagline: (tagline ?? "").trim(),
        concept: concept.trim(),
        target_market: target_market.trim(),
        business_model: business_model.trim(),
        revenue_streams: Array.isArray(revenue_streams) ? revenue_streams : [],
        architecture: typeof architecture === "object" ? architecture : {},
        mvp_plan: Array.isArray(mvp_plan) ? mvp_plan : [],
        simulation,
      })
      .select("id, name, tagline, status, simulation, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear la startup." });
    return res.status(201).json({ startup: data });
  }

  if (req.method === "PATCH") {
    const { id, status, mvp_plan, architecture, simulation } = req.body ?? {};
    if (typeof id !== "string") return res.status(400).json({ error: "Falta 'id'." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (mvp_plan) updates.mvp_plan = mvp_plan;
    if (architecture) updates.architecture = architecture;
    if (simulation) updates.simulation = simulation;
    const { data, error } = await supabase
      .from("lab_startups")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, status, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la startup." });
    return res.status(200).json({ startup: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
