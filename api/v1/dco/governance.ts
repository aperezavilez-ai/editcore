import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/governance?status=...  — decisiones del Governance Board
 * POST /api/v1/dco/governance             — registrar decision para revision
 * PATCH /api/v1/dco/governance            — decidir / implementar
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase.from("dco_governance_decisions")
      .select("id, title, decision_type, description, options, recommendation, decision, rationale, risk_level, requires_human, status, decided_by, decided_at, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar decisiones." });
    const pending = (data ?? []).filter(d => d.status === "pending").length;
    return res.status(200).json({ decisions: data, summary: { total: data?.length ?? 0, pending } });
  }

  if (req.method === "POST") {
    const { title, decision_type, description, options, recommendation, risk_level, requires_human } = req.body ?? {};
    if (!title?.trim() || !description?.trim()) return res.status(400).json({ error: "Faltan title y description." });
    const { data, error } = await supabase.from("dco_governance_decisions").insert({
      user_id: user.id, title: title.trim(), decision_type: decision_type ?? "strategic",
      description: description.trim(), options: Array.isArray(options) ? options : [],
      recommendation: recommendation ?? null, risk_level: risk_level ?? "medium",
      requires_human: requires_human !== false,
    }).select("id, title, decision_type, risk_level, requires_human, status, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo registrar la decision." });
    return res.status(201).json({ decision: data });
  }

  if (req.method === "PATCH") {
    const { id, status, decision, rationale, decided_by } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (decision) updates.decision = decision;
    if (rationale) updates.rationale = rationale;
    if (decided_by) { updates.decided_by = decided_by; updates.decided_at = new Date().toISOString(); }
    const { data, error } = await supabase.from("dco_governance_decisions").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, title, status, decision, decided_by, decided_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la decision." });
    return res.status(200).json({ decision: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
