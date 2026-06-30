import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/factory/releases?project_id=... — historial de releases.
 * POST /api/v1/factory/releases — crea un release versionado.
 *
 * Sistema de gestión de versiones real: cada release es inmutable (no se
 * sobrescribe), se puede marcar is_active=false para hacer rollback visual
 * en el dashboard. El rollback real (código) requiere acción en el repo
 * de git — esto es el registro, no la ejecución.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  if (req.method === "GET") {
    const projectId = typeof req.query.project_id === "string" ? req.query.project_id : undefined;
    if (!projectId) return res.status(400).json({ error: "Falta 'project_id'." });
    const { data, error } = await supabase
      .from("factory_releases")
      .select("id, version, channel, release_notes, commit_sha, deploy_url, is_active, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "No se pudieron listar los releases." });
    return res.status(200).json({ releases: data });
  }

  if (req.method === "POST") {
    const { project_id, version, channel, release_notes, commit_sha, deploy_url } = req.body ?? {};
    if (typeof project_id !== "string" || typeof version !== "string" || !version.trim()) {
      return res.status(400).json({ error: "Faltan 'project_id' y/o 'version'." });
    }
    const { data, error } = await supabase
      .from("factory_releases")
      .insert({ project_id, version: version.trim(), channel: channel ?? "production", release_notes: release_notes ?? null, commit_sha: commit_sha ?? null, deploy_url: deploy_url ?? null })
      .select("id, version, channel, is_active, created_at")
      .single();
    if (error) {
      const msg = error.code === "23505" ? `Ya existe el release ${version} para este proyecto.` : "No se pudo crear el release.";
      return res.status(400).json({ error: msg });
    }
    await supabase.from("factory_projects").update({ current_version: version.trim(), updated_at: new Date().toISOString() }).eq("id", project_id).eq("user_id", user.id);
    return res.status(201).json({ release: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
