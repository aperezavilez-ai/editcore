import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/agents — lista agentes públicos (sin sesión) o los propios
 *      del usuario autenticado (con Bearer token, incluye privados).
 * POST /api/v1/agents — crea un agente nuevo con su versión 1 (requiere
 *      sesión de Supabase Auth). Body: { slug, name, description?, config, isPublic? }.
 *
 * Modela "agente" como recurso real de plataforma (ver
 * docs/EDITCORE_ECOSYSTEM_ARCHITECTURE.md), prerrequisito de Agent Store
 * y Agent Version Control. El versionado vive en agent_versions.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const user = await resolveUserFromBearerToken(req.headers.authorization);

  if (req.method === "GET") {
    let query = supabase
      .from("agent_definitions")
      .select("id, slug, name, description, is_public, current_version, user_id, created_at, updated_at")
      .order("created_at", { ascending: false });
    query = user ? query.or(`is_public.eq.true,user_id.eq.${user.id}`) : query.eq("is_public", true);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "No se pudieron listar los agentes." });
    return res.status(200).json({ agents: data });
  }

  if (req.method === "POST") {
    if (!user) return res.status(401).json({ error: "Token inválido o expirado." });
    const { slug, name, description, config, isPublic } = req.body ?? {};
    if (typeof slug !== "string" || !slug.trim() || typeof name !== "string" || !name.trim() || typeof config !== "object" || config === null) {
      return res.status(400).json({ error: "Faltan campos obligatorios: slug, name, config." });
    }

    const { data: agent, error: agentError } = await supabase
      .from("agent_definitions")
      .insert({
        user_id: user.id,
        slug: slug.trim(),
        name: name.trim(),
        description: typeof description === "string" ? description : null,
        is_public: isPublic === true,
      })
      .select("id, slug, name, description, is_public, current_version, created_at, updated_at")
      .single();
    if (agentError) {
      const msg = agentError.code === "23505" ? "Ya existe un agente con ese slug." : "No se pudo crear el agente.";
      return res.status(400).json({ error: msg });
    }

    const { error: versionError } = await supabase
      .from("agent_versions")
      .insert({ agent_id: agent.id, version_number: 1, config, changelog: "Versión inicial" });
    if (versionError) return res.status(500).json({ error: "Agente creado pero falló la versión inicial." });

    return res.status(201).json({ agent });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
