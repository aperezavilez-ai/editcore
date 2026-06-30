import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/network/quality?project_id=...  — revisiones de calidad
 * POST /api/v1/network/quality                 — crear revision de calidad
 *
 * Dimensiones evaluadas: code_quality, security, architecture, performance, ux
 * Cada dimension tiene score 0-100. El overall_score es el promedio.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const projectId = typeof req.query.project_id === "string" ? req.query.project_id : undefined;
    let q = supabase
      .from("quality_reviews")
      .select("id, reviewer_agent, dimensions, overall_score, issues, approved, notes, project_id, task_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar las revisiones." });
    return res.status(200).json({ reviews: data });
  }

  if (req.method === "POST") {
    const { project_id, task_id, reviewer_agent, dimensions, issues, notes } = req.body ?? {};
    if (typeof reviewer_agent !== "string") {
      return res.status(400).json({ error: "Falta 'reviewer_agent'." });
    }

    const dims = dimensions ?? {
      code_quality:  70,
      security:      70,
      architecture:  70,
      performance:   70,
      ux:            70,
    };

    const scores = Object.values(dims).filter(v => typeof v === "number") as number[];
    const overall = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const approved = overall >= 70;

    const { data, error } = await supabase
      .from("quality_reviews")
      .insert({
        user_id: user.id,
        project_id: typeof project_id === "string" ? project_id : null,
        task_id: typeof task_id === "string" ? task_id : null,
        reviewer_agent,
        dimensions: dims,
        overall_score: overall,
        issues: Array.isArray(issues) ? issues : [],
        approved,
        notes: notes ?? null,
      })
      .select("id, reviewer_agent, overall_score, approved, created_at")
      .single();

    if (error) return res.status(500).json({ error: "No se pudo crear la revision." });
    return res.status(201).json({ review: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
