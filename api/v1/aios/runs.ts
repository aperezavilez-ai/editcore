import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/aios/runs?project_id=...  — lista runs del usuario
 * PATCH /api/v1/aios/runs?id=...         — actualiza status o step
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const projectId = typeof req.query.project_id === "string" ? req.query.project_id : undefined;
    let query = supabase
      .from("ai_orchestration_runs")
      .select("id, goal, status, autonomy_level, agent_sequence, current_step, result, error_detail, started_at, completed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "No se pudieron listar los runs." });
    return res.status(200).json({ runs: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const allowed = ["status", "current_step", "result", "error_detail", "completed_at"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (req.body ?? {})) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: "Sin campos para actualizar." });
    const { data, error } = await supabase
      .from("ai_orchestration_runs")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, status, current_step, updated_at:created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el run." });
    return res.status(200).json({ run: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
