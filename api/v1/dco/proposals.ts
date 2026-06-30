import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/dco/proposals?lead_id=...  — propuestas comerciales
 * POST  /api/v1/dco/proposals              — crear propuesta
 * PATCH /api/v1/dco/proposals              — actualizar estado
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const leadId = typeof req.query.lead_id === "string" ? req.query.lead_id : undefined;
    let q = supabase.from("dco_proposals")
      .select("id, lead_id, product_id, title, content, value_usd_cents, status, valid_until, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (leadId) q = q.eq("lead_id", leadId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar propuestas." });
    return res.status(200).json({ proposals: data, total: data?.length ?? 0 });
  }

  if (req.method === "POST") {
    const { lead_id, product_id, title, content, value_usd_cents, valid_until } = req.body ?? {};
    if (!lead_id || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "Faltan lead_id, title, content." });
    }
    const { data, error } = await supabase.from("dco_proposals").insert({
      user_id: user.id, lead_id, product_id: product_id ?? null, title: title.trim(),
      content: content.trim(), value_usd_cents: value_usd_cents ?? 0, valid_until: valid_until ?? null,
    }).select("id, lead_id, title, value_usd_cents, status, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear la propuesta." });
    return res.status(201).json({ proposal: data });
  }

  if (req.method === "PATCH") {
    const { id, status } = req.body ?? {};
    if (!id || !status) return res.status(400).json({ error: "Faltan id, status." });
    const { data, error } = await supabase.from("dco_proposals").update({ status }).eq("id", id).eq("user_id", user.id)
      .select("id, title, status").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la propuesta." });
    return res.status(200).json({ proposal: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
