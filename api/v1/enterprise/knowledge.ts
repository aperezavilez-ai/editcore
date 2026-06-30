import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/enterprise/knowledge?category=...  — documentos del knowledge hub
 * POST /api/v1/enterprise/knowledge               — crear documento
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    let q = supabase
      .from("biz_knowledge_docs")
      .select("id, title, category, tags, owner_agent, version, is_public, created_at, updated_at")
      .or(`is_public.eq.true,user_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los documentos." });
    return res.status(200).json({ docs: data });
  }

  if (req.method === "POST") {
    const { title, category, content, tags, owner_agent, is_public } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Faltan 'title' y/o 'content'." });
    }
    const { data, error } = await supabase
      .from("biz_knowledge_docs")
      .insert({
        user_id: user.id,
        title: title.trim(),
        category: category ?? "process",
        content: content.trim(),
        tags: Array.isArray(tags) ? tags : [],
        owner_agent: owner_agent ?? null,
        is_public: is_public === true,
        version: 1,
      })
      .select("id, title, category, version, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el documento." });
    return res.status(201).json({ doc: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
