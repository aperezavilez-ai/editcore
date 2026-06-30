import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/enterprise/okrs           — listar OKRs
 * POST  /api/v1/enterprise/okrs           — crear OKR
 * PATCH /api/v1/enterprise/okrs?id=...    — actualizar progreso o KRs
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const period = typeof req.query.period === "string" ? req.query.period : undefined;
    let q = supabase
      .from("biz_okrs")
      .select("id, objective, key_results, period, owner_agent, progress, status, project_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (period) q = q.eq("period", period);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los OKRs." });
    return res.status(200).json({ okrs: data });
  }

  if (req.method === "POST") {
    const { objective, key_results, period, owner_agent, project_id } = req.body ?? {};
    if (typeof objective !== "string" || !objective.trim() || typeof period !== "string" || !period.trim()) {
      return res.status(400).json({ error: "Faltan 'objective' y/o 'period'." });
    }
    const krs = Array.isArray(key_results) ? key_results : [];
    const { data, error } = await supabase
      .from("biz_okrs")
      .insert({
        user_id: user.id,
        objective: objective.trim(),
        key_results: krs,
        period: period.trim(),
        owner_agent: owner_agent ?? null,
        project_id: typeof project_id === "string" ? project_id : null,
        progress: 0,
        status: "active",
      })
      .select("id, objective, period, progress, status")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el OKR." });
    return res.status(201).json({ okr: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ["objective", "key_results", "period", "owner_agent", "progress", "status"];
    for (const k of allowed) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    // Recalcular progress automaticamente desde key_results si se actualizan
    if (Array.isArray(req.body?.key_results)) {
      const krs = req.body.key_results as { target: number; current: number }[];
      const valid = krs.filter(k => typeof k.target === "number" && k.target > 0);
      if (valid.length > 0) {
        const avg = valid.reduce((acc, k) => acc + Math.min(100, Math.round((k.current / k.target) * 100)), 0) / valid.length;
        updates["progress"] = Math.min(100, Math.round(avg));
      }
    }
    const { data, error } = await supabase
      .from("biz_okrs")
      .update(updates)
      .eq("id", id).eq("user_id", user.id)
      .select("id, objective, progress, status").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el OKR." });
    return res.status(200).json({ okr: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
