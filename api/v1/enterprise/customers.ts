import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/enterprise/customers         — listar clientes
 * POST  /api/v1/enterprise/customers         — crear cliente
 * PATCH /api/v1/enterprise/customers?id=...  — actualizar cliente
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    let q = supabase
      .from("biz_customers")
      .select("id, name, company, email, contract_value, contract_start, contract_end, status, assigned_agent, notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los clientes." });
    return res.status(200).json({ customers: data });
  }

  if (req.method === "POST") {
    const { name, company, email, contract_value, contract_start, contract_end, assigned_agent, notes } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Falta 'name'." });
    }
    const { data, error } = await supabase
      .from("biz_customers")
      .insert({
        user_id: user.id,
        name: name.trim(),
        company: company ?? null,
        email: email ?? null,
        contract_value: typeof contract_value === "number" ? contract_value : 0,
        contract_start: contract_start ?? null,
        contract_end: contract_end ?? null,
        assigned_agent: assigned_agent ?? null,
        notes: notes ?? null,
        status: "active",
      })
      .select("id, name, company, status, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el cliente." });
    return res.status(201).json({ customer: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const allowed = ["name", "company", "email", "contract_value", "contract_start", "contract_end", "status", "assigned_agent", "notes"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    const { data, error } = await supabase
      .from("biz_customers")
      .update(updates)
      .eq("id", id).eq("user_id", user.id)
      .select("id, name, status").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el cliente." });
    return res.status(200).json({ customer: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
