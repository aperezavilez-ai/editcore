import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveOrganizationFromKey } from "../../lib/orgAuth";

/** GET /api/org/plan — datos de organización + plan, para el Customer Dashboard (Fase 6). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orgId = await resolveOrganizationFromKey(req.headers["x-editcore-org-key"] as string | undefined);
  if (!orgId) {
    return res.status(401).json({ error: "Organization key inválida o revocada." });
  }

  const supabase = getSupabaseAdmin();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, plan, created_at")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return res.status(404).json({ error: "Organización no encontrada." });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_subscription_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return res.status(200).json({ organization: org, subscription: subscription ?? null });
}
