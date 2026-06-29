import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveOrganizationFromKey } from "../../lib/orgAuth";

/**
 * GET /api/usage/summary
 * Devuelve consumo del mes en curso vs. el límite del plan (Fase 4: AI Usage
 * Management). Esto es lo que alimenta el "límite inteligente" real: si
 * tokensUsed >= monthlyTokenLimit, la extensión puede avisar al usuario.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orgId = await resolveOrganizationFromKey(req.headers["x-editcore-org-key"] as string | undefined);
  if (!orgId) {
    return res.status(401).json({ error: "Organization key inválida o revocada." });
  }

  const supabase = getSupabaseAdmin();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  if (orgError || !org) {
    return res.status(404).json({ error: "Organización no encontrada." });
  }

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("monthly_token_limit, included_seats, storage_mb")
    .eq("plan", org.plan)
    .single();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: events, error: eventsError } = await supabase
    .from("usage_events")
    .select("input_tokens, output_tokens, estimated_cost_usd")
    .eq("organization_id", orgId)
    .gte("created_at", startOfMonth.toISOString());

  if (eventsError) {
    return res.status(500).json({ error: eventsError.message });
  }

  const tokensUsed = (events ?? []).reduce(
    (sum, e) => sum + (e.input_tokens ?? 0) + (e.output_tokens ?? 0),
    0
  );
  const costUsd = (events ?? []).reduce((sum, e) => sum + Number(e.estimated_cost_usd ?? 0), 0);

  return res.status(200).json({
    plan: org.plan,
    monthlyTokenLimit: limits?.monthly_token_limit ?? null,
    includedSeats: limits?.included_seats ?? null,
    tokensUsedThisMonth: tokensUsed,
    estimatedCostUsdThisMonth: costUsd,
    overLimit: limits ? tokensUsed >= limits.monthly_token_limit : false,
  });
}
