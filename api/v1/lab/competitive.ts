import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/competitive?category=...  — inteligencia competitiva
 * POST /api/v1/lab/competitive               — registrar analisis de competidor
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    let q = supabase
      .from("lab_competitive_intel")
      .select("id, competitor_name, category, strengths, weaknesses, features, differentiators, threat_level, recommendations, last_analyzed_at, created_at")
      .eq("user_id", user.id)
      .order("threat_level", { ascending: false })
      .limit(50);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar la inteligencia competitiva." });
    return res.status(200).json({ competitors: data });
  }

  if (req.method === "POST") {
    const { competitor_name, category, strengths, weaknesses, features, differentiators, threat_level, recommendations } = req.body ?? {};
    if (!competitor_name?.trim()) {
      return res.status(400).json({ error: "Falta 'competitor_name'." });
    }
    const { data, error } = await supabase
      .from("lab_competitive_intel")
      .insert({
        user_id: user.id,
        competitor_name: competitor_name.trim(),
        category: category ?? "direct",
        strengths: Array.isArray(strengths) ? strengths : [],
        weaknesses: Array.isArray(weaknesses) ? weaknesses : [],
        features: Array.isArray(features) ? features : [],
        differentiators: differentiators ?? null,
        threat_level: threat_level ?? "medium",
        recommendations: Array.isArray(recommendations) ? recommendations : [],
        last_analyzed_at: new Date().toISOString(),
      })
      .select("id, competitor_name, threat_level, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo registrar el competidor." });
    return res.status(201).json({ competitor: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
