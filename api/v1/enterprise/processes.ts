import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/enterprise/processes          — listar procesos
 * POST  /api/v1/enterprise/processes          — crear proceso
 * PATCH /api/v1/enterprise/processes?id=...   — actualizar / ejecutar
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("biz_processes")
      .select("id, name, description, steps, trigger_type, status, owner_agent, run_count, last_run_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "No se pudieron listar los procesos." });
    return res.status(200).json({ processes: data });
  }

  if (req.method === "POST") {
    const { name, description, steps, trigger_type, owner_agent } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Falta 'name'." });
    }
    const { data, error } = await supabase
      .from("biz_processes")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description ?? null,
        steps: Array.isArray(steps) ? steps : [],
        trigger_type: trigger_type ?? "manual",
        owner_agent: owner_agent ?? null,
        status: "draft",
      })
      .select("id, name, status, trigger_type, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el proceso." });
    return res.status(201).json({ process: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ["name", "description", "steps", "trigger_type", "status", "owner_agent"];
    for (const k of allowed) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    // Si se marca como "run", incrementar contador
    if (req.body?.run === true) {
      const { data: current } = await supabase.from("biz_processes").select("run_count").eq("id", id).single();
      updates["run_count"] = (current?.run_count ?? 0) + 1;
      updates["last_run_at"] = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("biz_processes")
      .update(updates)
      .eq("id", id).eq("user_id", user.id)
      .select("id, name, status, run_count").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el proceso." });
    return res.status(200).json({ process: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
