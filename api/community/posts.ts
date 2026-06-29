import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../lib/userAuth";

/**
 * GET  /api/community/posts — lista publicaciones (públicas, sin sesión).
 * POST /api/community/posts — crea una publicación (requiere sesión).
 *
 * Capa social mínima sobre la autenticación individual que ya existe
 * (login.html/account.html). Prerrequisito real de Community.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("community_posts")
      .select("id, title, body, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: "No se pudieron listar las publicaciones." });
    return res.status(200).json({ posts: data });
  }

  if (req.method === "POST") {
    const user = await resolveUserFromBearerToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Token inválido o expirado." });
    const { title, body } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ error: "Faltan 'title' y/o 'body'." });
    }
    const { data, error } = await supabase
      .from("community_posts")
      .insert({ user_id: user.id, title: title.trim(), body: body.trim() })
      .select("id, title, body, user_id, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear la publicación." });
    return res.status(201).json({ post: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
