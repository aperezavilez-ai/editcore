import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveDeveloperKey, hasScope, checkRateLimit } from "../../../lib/developerAuth";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/architect/patterns — biblioteca pública de patrones de
 *      arquitectura (filtrables por ?category=saas|enterprise|ai|...).
 *      Acepta tanto sesión de usuario (Bearer token) como developer API key.
 * POST /api/v1/architect/patterns — contribuye un patrón (requiere sesión).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    let query = supabase
      .from("architecture_patterns")
      .select("id, title, category, description, tech_stack, content, is_official, created_at")
      .order("is_official", { ascending: false })
      .order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);

    const devKey = await resolveDeveloperKey(req.headers["x-editcore-api-key"] as string | undefined);
    if (devKey) {
      if (!hasScope(devKey, "api:read")) return res.status(403).json({ error: "Scope api:read requerido." });
      const rl = checkRateLimit(devKey);
      res.setHeader("X-RateLimit-Limit", String(devKey.rateLimitPerMinute));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(rl.remaining, 0)));
      if (!rl.allowed) return res.status(429).json({ error: "Límite de solicitudes excedido." });
    }

    const { data, error } = await query.limit(100);
    if (error) return res.status(500).json({ error: "No se pudieron listar los patrones." });
    return res.status(200).json({ patterns: data });
  }

  if (req.method === "POST") {
    const user = await resolveUserFromBearerToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Token inválido o expirado." });
    const { title, category, description, tech_stack, content } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim() || typeof category !== "string") {
      return res.status(400).json({ error: "Faltan campos: title, category, content." });
    }
    const { data, error } = await supabase
      .from("architecture_patterns")
      .insert({ title: title.trim(), category, description: typeof description === "string" ? description.trim() : "", tech_stack: Array.isArray(tech_stack) ? tech_stack : [], content: content.trim(), user_id: user.id })
      .select("id, title, category, description, tech_stack, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo guardar el patrón." });
    return res.status(201).json({ pattern: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
