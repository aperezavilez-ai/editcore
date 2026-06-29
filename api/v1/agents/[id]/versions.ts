import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../../lib/userAuth";

/**
 * GET  /api/v1/agents/:id/versions — historial de versiones de un agente
 *      (público si el agente es público, o del dueño con sesión).
 * POST /api/v1/agents/:id/versions — agrega una nueva versión (solo el
 *      dueño, requiere sesión). Body: { config, changelog? }.
 *
 * Esto es el versionado real: cada cambio crea una fila nueva en vez de
 * sobrescribir, permitiendo historial y futuro rollback.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const agentId = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!agentId) return res.status(400).json({ error: "Falta el id del agente." });

  const { data: agent, error: agentError } = await supabase
    .from("agent_definitions")
    .select("id, user_id, is_public, current_version")
    .eq("id", agentId)
    .maybeSingle();
  if (agentError || !agent) return res.status(404).json({ error: "Agente no encontrado." });

  if (req.method === "GET") {
    const user = await resolveUserFromBearerToken(req.headers.authorization);
    if (!agent.is_public && agent.user_id !== user?.id) {
      return res.status(403).json({ error: "Este agente no es público." });
    }
    const { data, error } = await supabase
      .from("agent_versions")
      .select("id, version_number, config, changelog, created_at")
      .eq("agent_id", agentId)
      .order("version_number", { ascending: false });
    if (error) return res.status(500).json({ error: "No se pudieron listar las versiones." });
    return res.status(200).json({ versions: data });
  }

  if (req.method === "POST") {
    const user = await resolveUserFromBearerToken(req.headers.authorization);
    if (!user || user.id !== agent.user_id) {
      return res.status(403).json({ error: "Solo el dueño del agente puede agregar versiones." });
    }
    const { config, changelog } = req.body ?? {};
    if (typeof config !== "object" || config === null) {
      return res.status(400).json({ error: "Falta 'config'." });
    }
    const nextVersion = agent.current_version + 1;
    const { data: version, error: versionError } = await supabase
      .from("agent_versions")
      .insert({ agent_id: agentId, version_number: nextVersion, config, changelog: typeof changelog === "string" ? changelog : null })
      .select("id, version_number, config, changelog, created_at")
      .single();
    if (versionError) return res.status(500).json({ error: "No se pudo crear la versión." });

    await supabase.from("agent_definitions").update({ current_version: nextVersion, updated_at: new Date().toISOString() }).eq("id", agentId);
    return res.status(201).json({ version });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
