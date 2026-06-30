import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/campaigns?status=...  — campanas de marketing
 * POST /api/v1/dco/campaigns             — crear campana
 * PATCH /api/v1/dco/campaigns            — actualizar metricas/status
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase.from("dco_campaigns")
      .select("id, name, campaign_type, objective, target_audience, channels, status, budget_usd_cents, spent_usd_cents, metrics, start_date, end_date, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar campanas." });
    return res.status(200).json({ campaigns: data, total: data?.length ?? 0 });
  }

  if (req.method === "POST") {
    const { name, campaign_type, objective, target_audience, channels, content, budget_usd_cents, start_date, end_date } = req.body ?? {};
    if (!name?.trim() || !objective?.trim() || !target_audience?.trim()) return res.status(400).json({ error: "Faltan name, objective y target_audience." });
    const { data, error } = await supabase.from("dco_campaigns").insert({
      user_id: user.id, name: name.trim(), campaign_type: campaign_type ?? "content",
      objective: objective.trim(), target_audience: target_audience.trim(),
      channels: Array.isArray(channels) ? channels : [],
      content: Array.isArray(content) ? content : [],
      budget_usd_cents: budget_usd_cents ?? 0,
      start_date: start_date ?? null, end_date: end_date ?? null,
    }).select("id, name, campaign_type, status, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear la campana." });
    return res.status(201).json({ campaign: data });
  }

  if (req.method === "PATCH") {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const allowed = ["status","spent_usd_cents","metrics","content","channels","end_date"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (fields[k] !== undefined) updates[k] = fields[k];
    const { data, error } = await supabase.from("dco_campaigns").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, name, status, metrics, updated_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la campana." });
    return res.status(200).json({ campaign: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
