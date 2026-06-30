import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/factory/tasks?project_id=... — tareas de un proyecto.
 * POST  /api/v1/factory/tasks — crea una tarea.
 * PATCH /api/v1/factory/tasks?id=... — actualiza estado/resultado/aprobación.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  if (req.method === "GET") {
    const projectId = typeof req.query.project_id === "string" ? req.query.project_id : undefined;
    if (!projectId) return res.status(400).json({ error: "Falta 'project_id'." });
    const { data, error } = await supabase
      .from("factory_tasks")
      .select("id, title, description, agent, status, priority, result, requires_human_approval, approved_by, created_at, updated_at")
      .eq("project_id", projectId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: "No se pudieron listar las tareas." });
    return res.status(200).json({ tasks: data });
  }

  if (req.method === "POST") {
    const { project_id, title, description, agent, priority, requires_human_approval } = req.body ?? {};
    if (typeof project_id !== "string" || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Faltan 'project_id' y/o 'title'." });
    }
    const { data, error } = await supabase
      .from("factory_tasks")
      .insert({ project_id, title: title.trim(), description: description ?? null, agent: agent ?? "fullstack", priority: typeof priority === "number" ? Math.min(4, Math.max(1, priority)) : 2, requires_human_approval: requires_human_approval === true })
      .select("id, title, agent, status, priority, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear la tarea." });
    return res.status(201).json({ task: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const allowed = ["status", "result", "agent"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in (req.body ?? {})) updates[key] = req.body[key];
    }
    if (req.body?.approved === true) updates["approved_by"] = user.id;
    const { data, error } = await supabase
      .from("factory_tasks")
      .update(updates)
      .eq("id", id)
      .select("id, title, status, result, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la tarea." });
    return res.status(200).json({ task: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
