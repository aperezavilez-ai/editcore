import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../lib/userAuth";
import { generateDeveloperApiKey } from "../../lib/developerAuth";

/**
 * GET  /api/developer/keys — lista las developer API keys del usuario autenticado.
 * POST /api/developer/keys — crea una nueva (devuelve la key en texto plano UNA sola vez).
 * DELETE /api/developer/keys?id=... — desactiva una key existente.
 *
 * Requiere `Authorization: Bearer <access_token>` de Supabase Auth (misma
 * sesión que usa /api/auth/me, web/login.html y EditCore IDE).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("developer_api_keys")
      .select("id, name, key_prefix, scopes, rate_limit_per_minute, is_active, last_used_at, created_at, expires_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "No se pudieron listar las claves." });
    return res.status(200).json({ keys: data });
  }

  if (req.method === "POST") {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "Falta 'name' para la clave." });

    const { rawKey, keyHash, keyPrefix } = generateDeveloperApiKey();
    const { data, error } = await supabase
      .from("developer_api_keys")
      .insert({ user_id: user.id, name, key_hash: keyHash, key_prefix: keyPrefix })
      .select("id, name, key_prefix, scopes, rate_limit_per_minute, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear la clave." });

    return res.status(201).json({
      ...data,
      apiKey: rawKey,
      warning: "Guarda esta clave ahora: no se puede volver a mostrar.",
    });
  }

  if (req.method === "DELETE") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const { error } = await supabase
      .from("developer_api_keys")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return res.status(500).json({ error: "No se pudo desactivar la clave." });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
