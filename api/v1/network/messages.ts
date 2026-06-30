import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/network/messages?thread_id=...  — mensajes de un hilo
 * POST /api/v1/network/messages                — enviar mensaje entre agentes
 *
 * Protocolo de comunicacion entre agentes: cada mensaje queda registrado
 * con sender, receiver, tipo y contenido. Permite trazabilidad completa.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const threadId = typeof req.query.thread_id === "string" ? req.query.thread_id : undefined;
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "50")));
    let q = supabase
      .from("agent_messages")
      .select("id, thread_id, sender_agent, receiver_agent, msg_type, subject, content, status, parent_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (threadId) q = q.eq("thread_id", threadId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los mensajes." });
    return res.status(200).json({ messages: data });
  }

  if (req.method === "POST") {
    const { sender_agent, receiver_agent, msg_type, subject, content, thread_id, team_id, parent_id } = req.body ?? {};
    if (typeof sender_agent !== "string" || !sender_agent.trim()) {
      return res.status(400).json({ error: "Falta 'sender_agent'." });
    }
    const { data, error } = await supabase
      .from("agent_messages")
      .insert({
        user_id: user.id,
        thread_id: typeof thread_id === "string" ? thread_id : undefined,
        sender_agent: sender_agent.trim(),
        receiver_agent: typeof receiver_agent === "string" ? receiver_agent : null,
        team_id: typeof team_id === "string" ? team_id : null,
        msg_type: msg_type ?? "request",
        subject: subject ?? null,
        content: content ?? {},
        parent_id: typeof parent_id === "string" ? parent_id : null,
        status: "sent",
      })
      .select("id, thread_id, sender_agent, receiver_agent, msg_type, status, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo enviar el mensaje." });
    return res.status(201).json({ message: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
