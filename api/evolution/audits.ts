import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

/**
 * GET /api/evolution/audits — últimas auditorías guardadas (lectura
 * pública de solo métricas agregadas, sin datos sensibles). Usado por
 * web/evolution.html (Fase 13: Centro de Evolución).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("evolution_audits")
    .select("id, kind, metrics, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: "No se pudieron listar las auditorías." });
  return res.status(200).json({ audits: data });
}
