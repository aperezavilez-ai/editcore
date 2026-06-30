import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/network/research?tag=...  — reportes de investigacion
 * POST /api/v1/network/research          — crear reporte de investigacion
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    let q = supabase
      .from("research_reports")
      .select("id, title, topic, findings, tags, quality_score, created_by_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (tag) q = q.contains("tags", [tag]);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los reportes." });
    return res.status(200).json({ reports: data });
  }

  if (req.method === "POST") {
    const { title, topic, findings, sources, tags, quality_score, team_id, created_by_agent } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || typeof findings !== "string" || !findings.trim()) {
      return res.status(400).json({ error: "Faltan 'title' y/o 'findings'." });
    }
    const { data, error } = await supabase
      .from("research_reports")
      .insert({
        user_id: user.id,
        team_id: typeof team_id === "string" ? team_id : null,
        title: title.trim(),
        topic: typeof topic === "string" ? topic : title.trim(),
        findings: findings.trim(),
        sources: Array.isArray(sources) ? sources : [],
        tags: Array.isArray(tags) ? tags : [],
        quality_score: typeof quality_score === "number" ? Math.min(100, Math.max(0, quality_score)) : 70,
        created_by_agent: created_by_agent ?? null,
      })
      .select("id, title, topic, quality_score, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el reporte." });
    return res.status(201).json({ report: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
