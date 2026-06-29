import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../lib/userAuth";

/**
 * GET  /api/evolution/proposals — lista propuestas de mejora (públicas).
 * POST /api/evolution/proposals — crea una propuesta (requiere sesión).
 *
 * Implementa Fase 3 (detección de oportunidades) y Fase 11 (ciclo de
 * aprobación) del Prompt 12 como registro real: cualquier persona con
 * cuenta (incluido el propio equipo) puede registrar una propuesta con un
 * nivel (1-5). No hay automatización que las implemente sola — niveles 4
 * y 5 quedan documentados como "requieren acción humana" (ver
 * docs/EDITCORE_EVOLUTION_WORKFLOW.md), por seguridad.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("evolution_proposals")
      .select("id, title, description, source, level, status, impact, complexity, outcome, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: "No se pudieron listar las propuestas." });
    return res.status(200).json({ proposals: data });
  }

  if (req.method === "POST") {
    const user = await resolveUserFromBearerToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

    const { title, description, level, impact, complexity, source } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "Faltan 'title' y/o 'description'." });
    }
    const parsedLevel = Number.isInteger(level) && level >= 1 && level <= 5 ? level : 1;

    const { data, error } = await supabase
      .from("evolution_proposals")
      .insert({
        title: title.trim(),
        description: description.trim(),
        level: parsedLevel,
        impact: typeof impact === "string" ? impact : null,
        complexity: typeof complexity === "string" ? complexity : null,
        source: source === "audit" || source === "community" ? source : "manual",
        created_by: user.id,
      })
      .select("id, title, description, source, level, status, impact, complexity, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear la propuesta." });
    return res.status(201).json({ proposal: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
