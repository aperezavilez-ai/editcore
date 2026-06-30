import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/leads?status=...  — pipeline de ventas
 * POST /api/v1/dco/leads             — registrar lead
 * PATCH /api/v1/dco/leads            — actualizar lead/stage
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase.from("dco_leads")
      .select("id, name, company, email, source, status, product_id, estimated_value_usd_cents, probability, next_action, next_action_date, assigned_agent, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar leads." });
    const pipeline_value = (data ?? []).reduce((a, l) => a + Math.round(l.estimated_value_usd_cents * l.probability / 100), 0);
    const won = (data ?? []).filter(l => l.status === "won").reduce((a, l) => a + l.estimated_value_usd_cents, 0);
    return res.status(200).json({ leads: data, summary: { total: data?.length ?? 0, pipeline_value_usd_cents: pipeline_value, won_usd_cents: won } });
  }

  if (req.method === "POST") {
    const { name, company, email, phone, source, product_id, estimated_value_usd_cents, notes, assigned_agent } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: "Falta name." });
    const { data, error } = await supabase.from("dco_leads").insert({
      user_id: user.id, name: name.trim(), company: company ?? null, email: email ?? null, phone: phone ?? null,
      source: source ?? "organic", product_id: product_id ?? null,
      estimated_value_usd_cents: estimated_value_usd_cents ?? 0, notes: notes ?? null, assigned_agent: assigned_agent ?? null,
    }).select("id, name, status, estimated_value_usd_cents, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear el lead." });
    return res.status(201).json({ lead: data });
  }

  if (req.method === "PATCH") {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const allowed = ["status","estimated_value_usd_cents","probability","notes","next_action","next_action_date","assigned_agent"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (fields[k] !== undefined) updates[k] = fields[k];
    const { data, error } = await supabase.from("dco_leads").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, name, status, probability, updated_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el lead." });
    return res.status(200).json({ lead: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
