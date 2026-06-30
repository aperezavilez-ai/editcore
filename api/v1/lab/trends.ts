import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/trends?category=...&strength=...  — senales de tendencia
 * POST /api/v1/lab/trends                             — registrar senal de tendencia
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { category, strength } = req.query;
    let q = supabase
      .from("lab_trend_signals")
      .select("id, signal_name, category, description, strength, opportunity_score, sectors, detected_at, created_at")
      .eq("user_id", user.id)
      .order("opportunity_score", { ascending: false })
      .limit(100);
    if (typeof category === "string") q = q.eq("category", category);
    if (typeof strength === "string") q = q.eq("strength", strength);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar las tendencias." });
    return res.status(200).json({ trends: data });
  }

  if (req.method === "POST") {
    const { signal_name, category, description, strength, opportunity_score, sectors } = req.body ?? {};
    if (!signal_name?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "Faltan campos: signal_name, description." });
    }
    const { data, error } = await supabase
      .from("lab_trend_signals")
      .insert({
        user_id: user.id,
        signal_name: signal_name.trim(),
        category: category ?? "technology",
        description: description.trim(),
        strength: strength ?? "emerging",
        opportunity_score: typeof opportunity_score === "number" ? Math.min(100, Math.max(0, opportunity_score)) : 50,
        sectors: Array.isArray(sectors) ? sectors : [],
      })
      .select("id, signal_name, strength, opportunity_score, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo registrar la tendencia." });
    return res.status(201).json({ trend: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
