import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/memory?type=...  — memorias de innovacion
 * POST /api/v1/lab/memory           — registrar aprendizaje/patron/decision
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    let q = supabase
      .from("lab_innovation_memory")
      .select("id, memory_type, title, content, source_type, impact, tags, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (type) q = q.eq("memory_type", type);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo recuperar la memoria de innovacion." });
    return res.status(200).json({ memories: data });
  }

  if (req.method === "POST") {
    const { memory_type, title, content, source_type, source_id, impact, tags } = req.body ?? {};
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "Faltan campos: title, content." });
    }
    const { data, error } = await supabase
      .from("lab_innovation_memory")
      .insert({
        user_id: user.id,
        memory_type: memory_type ?? "learning",
        title: title.trim(),
        content: content.trim(),
        source_type: source_type ?? null,
        source_id: typeof source_id === "string" ? source_id : null,
        impact: impact ?? "medium",
        tags: Array.isArray(tags) ? tags : [],
      })
      .select("id, memory_type, title, impact, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo guardar la memoria." });
    return res.status(201).json({ memory: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
