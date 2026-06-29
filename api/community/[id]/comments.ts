import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/community/:id/comments — lista comentarios de una publicación.
 * POST /api/community/:id/comments — agrega un comentario (requiere sesión).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const postId = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!postId) return res.status(400).json({ error: "Falta el id de la publicación." });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("community_comments")
      .select("id, body, user_id, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: "No se pudieron listar los comentarios." });
    return res.status(200).json({ comments: data });
  }

  if (req.method === "POST") {
    const user = await resolveUserFromBearerToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Token inválido o expirado." });
    const { body } = req.body ?? {};
    if (typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ error: "Falta 'body'." });
    }
    const { data, error } = await supabase
      .from("community_comments")
      .insert({ post_id: postId, user_id: user.id, body: body.trim() })
      .select("id, body, user_id, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el comentario." });
    return res.status(201).json({ comment: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
