import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/products?status=...  — portafolio de productos
 * POST /api/v1/dco/products             — registrar producto
 * PATCH /api/v1/dco/products            — actualizar metricas/status/roadmap
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase.from("dco_products")
      .select("id, name, description, category, status, stage, mrr_usd_cents, active_users, nps_score, profitability, roadmap, priorities, owner_agent, created_at")
      .eq("user_id", user.id).order("mrr_usd_cents", { ascending: false }).limit(50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar el portafolio." });
    const totalMrr = (data ?? []).reduce((a, p) => a + p.mrr_usd_cents, 0);
    return res.status(200).json({ products: data, summary: { total: data?.length ?? 0, total_mrr_usd_cents: totalMrr } });
  }

  if (req.method === "POST") {
    const { name, description, category, status, stage, mrr_usd_cents, active_users, roadmap, priorities, owner_agent } = req.body ?? {};
    if (!name?.trim() || !description?.trim()) return res.status(400).json({ error: "Faltan name y description." });
    const { data, error } = await supabase.from("dco_products").insert({
      user_id: user.id, name: name.trim(), description: description.trim(),
      category: category ?? "saas", status: status ?? "idea", stage: stage ?? "planning",
      mrr_usd_cents: mrr_usd_cents ?? 0, active_users: active_users ?? 0,
      roadmap: Array.isArray(roadmap) ? roadmap : [],
      priorities: Array.isArray(priorities) ? priorities : [],
      owner_agent: owner_agent ?? null,
    }).select("id, name, status, mrr_usd_cents, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear el producto." });
    return res.status(201).json({ product: data });
  }

  if (req.method === "PATCH") {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const allowed = ["name","description","status","stage","mrr_usd_cents","active_users","nps_score","profitability","roadmap","priorities","owner_agent"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (fields[k] !== undefined) updates[k] = fields[k];
    const { data, error } = await supabase.from("dco_products").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, name, status, mrr_usd_cents, active_users, updated_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el producto." });
    return res.status(200).json({ product: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
