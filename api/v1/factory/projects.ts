import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/factory/projects — proyectos de la fábrica del usuario.
 * POST /api/v1/factory/projects — crea un proyecto nuevo.
 * PATCH /api/v1/factory/projects?id=... — actualiza estado/versión/urls.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("factory_projects")
      .select("id, name, description, status, tech_stack, repo_url, deploy_url, current_version, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ error: "No se pudieron listar los proyectos." });
    return res.status(200).json({ projects: data });
  }

  if (req.method === "POST") {
    const { name, description, tech_stack, repo_url, product_requirements } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Falta 'name'." });
    const { data, error } = await supabase
      .from("factory_projects")
      .insert({ user_id: user.id, name: name.trim(), description: description ?? null, tech_stack: Array.isArray(tech_stack) ? tech_stack : [], repo_url: repo_url ?? null, product_requirements: product_requirements ?? null })
      .select("id, name, status, current_version, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el proyecto." });
    return res.status(201).json({ project: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const allowed = ["status", "current_version", "repo_url", "deploy_url", "product_requirements", "description", "tech_stack"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in (req.body ?? {})) updates[key] = req.body[key];
    }
    const { data, error } = await supabase
      .from("factory_projects")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, status, current_version, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el proyecto." });
    return res.status(200).json({ project: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
