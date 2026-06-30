import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/network/knowledge?type=...&tag=...  — nodos del grafo
 * POST /api/v1/network/knowledge                   — crear nodo
 *
 * Tambien maneja aristas:
 * POST /api/v1/network/knowledge/edges             — conectar nodos
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();
  const path = req.url ?? "";

  // Edges endpoint
  if (path.includes("/edges")) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { from_node_id, to_node_id, relation_type, weight } = req.body ?? {};
    if (!from_node_id || !to_node_id || !relation_type) {
      return res.status(400).json({ error: "Faltan 'from_node_id', 'to_node_id' o 'relation_type'." });
    }
    const { data, error } = await supabase
      .from("knowledge_edges")
      .insert({ from_node_id, to_node_id, relation_type, weight: weight ?? 50 })
      .select("id, from_node_id, to_node_id, relation_type, weight")
      .single();
    if (error) {
      const msg = error.code === "23505" ? "Esa conexion ya existe." : "No se pudo crear la conexion.";
      return res.status(400).json({ error: msg });
    }
    return res.status(201).json({ edge: data });
  }

  if (req.method === "GET") {
    const nodeType = typeof req.query.type === "string" ? req.query.type : undefined;
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    const publicOnly = req.query.public === "true";

    let q = supabase
      .from("knowledge_nodes")
      .select("id, node_type, title, summary, tags, is_public, confidence, source_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (publicOnly) {
      q = q.eq("is_public", true);
    } else {
      q = q.or(`is_public.eq.true,user_id.eq.${user.id}`);
    }
    if (nodeType) q = q.eq("node_type", nodeType);
    if (tag) q = q.contains("tags", [tag]);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo obtener el grafo." });
    return res.status(200).json({ nodes: data });
  }

  if (req.method === "POST") {
    const { node_type, title, summary, content, tags, is_public, source_agent, confidence } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || !node_type) {
      return res.status(400).json({ error: "Faltan 'title' y/o 'node_type'." });
    }
    const { data, error } = await supabase
      .from("knowledge_nodes")
      .insert({
        user_id: user.id,
        node_type,
        title: title.trim(),
        summary: summary ?? null,
        content: content ?? {},
        tags: Array.isArray(tags) ? tags : [],
        is_public: is_public === true,
        source_agent: source_agent ?? null,
        confidence: typeof confidence === "number" ? Math.min(100, Math.max(0, confidence)) : 80,
      })
      .select("id, node_type, title, tags, is_public, confidence, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el nodo." });
    return res.status(201).json({ node: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
