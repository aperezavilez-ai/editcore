import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/research?type=...  — reportes de investigacion
 * POST /api/v1/lab/research           — crear reporte de investigacion
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    let q = supabase
      .from("lab_research_reports")
      .select("id, title, report_type, summary, tags, generated_by, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (type) q = q.eq("report_type", type);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los reportes." });
    return res.status(200).json({ reports: data });
  }

  if (req.method === "POST") {
    const { title, report_type, content, summary, sources, tags, generated_by } = req.body ?? {};
    if (!title?.trim() || !content?.trim() || !summary?.trim()) {
      return res.status(400).json({ error: "Faltan campos: title, content, summary." });
    }
    const { data, error } = await supabase
      .from("lab_research_reports")
      .insert({
        user_id: user.id,
        title: title.trim(),
        report_type: report_type ?? "technology",
        content: content.trim(),
        summary: summary.trim(),
        sources: Array.isArray(sources) ? sources : [],
        tags: Array.isArray(tags) ? tags : [],
        generated_by: generated_by ?? "research-agent",
      })
      .select("id, title, report_type, summary, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el reporte." });
    return res.status(201).json({ report: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
