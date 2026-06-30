import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/prototypes?status=...  — listar prototipos
 * POST /api/v1/lab/prototypes             — registrar prototipo
 * PATCH /api/v1/lab/prototypes            — actualizar status/demo_url/notas
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase
      .from("lab_prototypes")
      .select("id, idea_id, name, description, proto_type, stack, architecture, status, demo_url, notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los prototipos." });
    return res.status(200).json({ prototypes: data });
  }

  if (req.method === "POST") {
    const { idea_id, name, description, proto_type, stack, architecture, notes } = req.body ?? {};
    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "Faltan campos: name, description." });
    }
    const { data, error } = await supabase
      .from("lab_prototypes")
      .insert({
        user_id: user.id,
        idea_id: typeof idea_id === "string" ? idea_id : null,
        name: name.trim(),
        description: description.trim(),
        proto_type: proto_type ?? "mvp",
        stack: Array.isArray(stack) ? stack : [],
        architecture: architecture ?? null,
        notes: notes ?? null,
      })
      .select("id, name, proto_type, status, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo registrar el prototipo." });
    return res.status(201).json({ prototype: data });
  }

  if (req.method === "PATCH") {
    const { id, status, demo_url, notes, architecture } = req.body ?? {};
    if (typeof id !== "string") return res.status(400).json({ error: "Falta 'id'." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (demo_url) updates.demo_url = demo_url;
    if (notes) updates.notes = notes;
    if (architecture) updates.architecture = architecture;
    const { data, error } = await supabase
      .from("lab_prototypes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, status, demo_url, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el prototipo." });
    return res.status(200).json({ prototype: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
