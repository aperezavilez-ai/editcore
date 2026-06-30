import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/enterprise/meetings          — listar reuniones
 * POST /api/v1/enterprise/meetings          — crear/registrar reunion
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("biz_meetings")
      .select("id, title, agenda, attendees, decisions, action_items, summary, held_at, project_id, customer_id, created_at")
      .eq("user_id", user.id)
      .order("held_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: "No se pudieron listar las reuniones." });
    return res.status(200).json({ meetings: data });
  }

  if (req.method === "POST") {
    const { title, agenda, attendees, decisions, action_items, summary, held_at, project_id, customer_id } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Falta 'title'." });
    }
    const { data, error } = await supabase
      .from("biz_meetings")
      .insert({
        user_id: user.id,
        title: title.trim(),
        agenda: Array.isArray(agenda) ? agenda : [],
        attendees: Array.isArray(attendees) ? attendees : [],
        decisions: Array.isArray(decisions) ? decisions : [],
        action_items: Array.isArray(action_items) ? action_items : [],
        summary: summary ?? null,
        held_at: held_at ?? new Date().toISOString(),
        project_id: typeof project_id === "string" ? project_id : null,
        customer_id: typeof customer_id === "string" ? customer_id : null,
      })
      .select("id, title, held_at, action_items")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo registrar la reunion." });
    return res.status(201).json({ meeting: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
