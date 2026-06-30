import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/growth  — iniciativas de crecimiento
 * POST /api/v1/dco/growth  — registrar iniciativa
 * PATCH /api/v1/dco/growth — actualizar estado/valor actual
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase.from("dco_growth_initiatives")
      .select("id, title, initiative_type, description, target_metric, target_value, current_value, market, strategy, status, estimated_impact, created_at")
      .eq("user_id", user.id).order("estimated_impact", { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: "No se pudo listar iniciativas." });
    return res.status(200).json({ initiatives: data, total: data?.length ?? 0 });
  }

  if (req.method === "POST") {
    const { title, initiative_type, description, target_metric, target_value, market, strategy, estimated_impact } = req.body ?? {};
    if (!title?.trim() || !description?.trim() || !target_metric?.trim() || !strategy?.trim()) return res.status(400).json({ error: "Faltan campos requeridos." });
    const { data, error } = await supabase.from("dco_growth_initiatives").insert({
      user_id: user.id, title: title.trim(), initiative_type: initiative_type ?? "acquisition",
      description: description.trim(), target_metric: target_metric.trim(),
      target_value: target_value ?? "TBD", market: market ?? null, strategy: strategy.trim(),
      estimated_impact: estimated_impact ?? "medium",
    }).select("id, title, initiative_type, status, estimated_impact, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear la iniciativa." });
    return res.status(201).json({ initiative: data });
  }

  if (req.method === "PATCH") {
    const { id, status, current_value } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (current_value !== undefined) updates.current_value = current_value;
    const { data, error } = await supabase.from("dco_growth_initiatives").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, title, status, current_value, updated_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la iniciativa." });
    return res.status(200).json({ initiative: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
