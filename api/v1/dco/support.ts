import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/dco/support?status=...&priority=...  — tickets de soporte
 * POST /api/v1/dco/support                          — crear ticket
 * PATCH /api/v1/dco/support                         — resolver/escalar ticket
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { status, priority } = req.query;
    let q = supabase.from("dco_support_tickets")
      .select("id, customer_name, customer_email, product_id, title, category, priority, status, resolution, assigned_agent, escalated_to_human, resolved_at, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (typeof status === "string") q = q.eq("status", status);
    if (typeof priority === "string") q = q.eq("priority", priority);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudo listar tickets." });
    const open = (data ?? []).filter(t => t.status === "open").length;
    const critical = (data ?? []).filter(t => t.priority === "critical").length;
    return res.status(200).json({ tickets: data, summary: { total: data?.length ?? 0, open, critical } });
  }

  if (req.method === "POST") {
    const { customer_name, customer_email, product_id, title, description, category, priority } = req.body ?? {};
    if (!customer_name?.trim() || !title?.trim() || !description?.trim()) return res.status(400).json({ error: "Faltan customer_name, title y description." });
    // Auto-asignar agente segun categoria
    const agentMap: Record<string, string> = { bug: "support-agent", billing: "finance-agent", feature_request: "product-agent", account: "support-agent" };
    const { data, error } = await supabase.from("dco_support_tickets").insert({
      user_id: user.id, customer_name: customer_name.trim(), customer_email: customer_email ?? null,
      product_id: product_id ?? null, title: title.trim(), description: description.trim(),
      category: category ?? "question", priority: priority ?? "medium",
      assigned_agent: agentMap[category ?? "question"] ?? "support-agent",
    }).select("id, title, category, priority, status, assigned_agent, created_at").single();
    if (error) return res.status(500).json({ error: "No se pudo crear el ticket." });
    return res.status(201).json({ ticket: data });
  }

  if (req.method === "PATCH") {
    const { id, status, resolution, escalated_to_human, assigned_agent } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Falta id." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) {
      updates.status = status;
      if (["resolved","closed"].includes(status)) updates.resolved_at = new Date().toISOString();
    }
    if (resolution) updates.resolution = resolution;
    if (escalated_to_human !== undefined) updates.escalated_to_human = escalated_to_human;
    if (assigned_agent) updates.assigned_agent = assigned_agent;
    const { data, error } = await supabase.from("dco_support_tickets").update(updates).eq("id", id).eq("user_id", user.id)
      .select("id, title, status, resolution, escalated_to_human, updated_at").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el ticket." });
    return res.status(200).json({ ticket: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
