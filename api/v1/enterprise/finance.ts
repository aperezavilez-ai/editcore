import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/enterprise/finance?period=...  — registros + resumen financiero
 * POST /api/v1/enterprise/finance             — registrar movimiento
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const period = typeof req.query.period === "string" ? req.query.period : undefined;
    let q = supabase
      .from("biz_finance_records")
      .select("id, period, category, amount_usd_cents, description, is_revenue, project_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (period) q = q.eq("period", period);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los registros." });

    // Resumen agregado
    const revenue = (data ?? []).filter(r => r.is_revenue).reduce((acc, r) => acc + r.amount_usd_cents, 0);
    const costs = (data ?? []).filter(r => !r.is_revenue).reduce((acc, r) => acc + r.amount_usd_cents, 0);
    const by_category: Record<string, number> = {};
    for (const r of data ?? []) {
      by_category[r.category] = (by_category[r.category] ?? 0) + r.amount_usd_cents;
    }

    return res.status(200).json({
      records: data,
      summary: {
        revenue_usd_cents: revenue,
        costs_usd_cents: costs,
        net_usd_cents: revenue - costs,
        by_category,
      },
    });
  }

  if (req.method === "POST") {
    const { period, category, amount_usd_cents, description, is_revenue, project_id } = req.body ?? {};
    if (typeof description !== "string" || !description.trim() || typeof amount_usd_cents !== "number") {
      return res.status(400).json({ error: "Faltan 'description' y/o 'amount_usd_cents'." });
    }
    const { data, error } = await supabase
      .from("biz_finance_records")
      .insert({
        user_id: user.id,
        period: typeof period === "string" ? period : new Date().toISOString().slice(0, 7),
        category: category ?? "other",
        amount_usd_cents: Math.abs(amount_usd_cents),
        description: description.trim(),
        is_revenue: is_revenue === true,
        project_id: typeof project_id === "string" ? project_id : null,
      })
      .select("id, period, category, amount_usd_cents, is_revenue")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo registrar el movimiento." });
    return res.status(201).json({ record: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
