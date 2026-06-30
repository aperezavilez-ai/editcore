import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveOrganizationFromKey } from "../../lib/orgAuth";
import { getStripe, priceIdForPlan } from "../../lib/stripeClient";

/**
 * POST /api/billing/checkout { plan, successUrl, cancelUrl }
 * Crea una sesión de Stripe Checkout para que la organización autenticada
 * suscriba (o cambie a) el plan pedido. Devuelve { url } para redirigir.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orgId = await resolveOrganizationFromKey(req.headers["x-editcore-org-key"] as string | undefined);
  if (!orgId) {
    return res.status(401).json({ error: "Organization key inválida o revocada." });
  }

  const { plan, successUrl, cancelUrl } = req.body ?? {};
  if (!plan || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: "plan, successUrl y cancelUrl son requeridos." });
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return res.status(400).json({ error: `No hay un Price de Stripe configurado para el plan "${plan}".` });
  }

  const supabase = getSupabaseAdmin();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .single();
  if (error || !org) {
    return res.status(404).json({ error: "Organización no encontrada." });
  }

  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existingSub?.stripe_customer_id ?? undefined,
    client_reference_id: orgId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { organization_id: orgId },
    subscription_data: { metadata: { organization_id: orgId } },
  });

  return res.status(200).json({ url: session.url });
}
