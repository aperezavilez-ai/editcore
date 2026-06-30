import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/experiments?status=...  — listar experimentos
 * POST /api/v1/lab/experiments             — crear experimento
 * PATCH /api/v1/lab/experiments            — actualizar resultados/status
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase
      .from("lab_experiments")
      .select("id, idea_id, title, hypothesis, method, success_criteria, results, learnings, status, started_at, completed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los experimentos." });
    return res.status(200).json({ experiments: data });
  }

  if (req.method === "POST") {
    const { idea_id, title, hypothesis, method, success_criteria } = req.body ?? {};
    if (!title?.trim() || !hypothesis?.trim() || !method?.trim() || !success_criteria?.trim()) {
      return res.status(400).json({ error: "Faltan campos: title, hypothesis, method, success_criteria." });
    }
    const { data, error } = await supabase
      .from("lab_experiments")
      .insert({
        user_id: user.id,
        idea_id: typeof idea_id === "string" ? idea_id : null,
        title: title.trim(),
        hypothesis: hypothesis.trim(),
        method: method.trim(),
        success_criteria: success_criteria.trim(),
      })
      .select("id, title, status, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el experimento." });
    return res.status(201).json({ experiment: data });
  }

  if (req.method === "PATCH") {
    const { id, status, results, learnings } = req.body ?? {};
    if (typeof id !== "string") return res.status(400).json({ error: "Falta 'id'." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) {
      updates.status = status;
      if (status === "running" && !req.body.started_at) updates.started_at = new Date().toISOString();
      if (["completed","failed","cancelled"].includes(status)) updates.completed_at = new Date().toISOString();
    }
    if (results) updates.results = results;
    if (learnings) updates.learnings = learnings;
    const { data, error } = await supabase
      .from("lab_experiments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, status, results, learnings, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el experimento." });
    return res.status(200).json({ experiment: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
