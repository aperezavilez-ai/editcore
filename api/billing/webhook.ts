import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { getStripe, planForPriceId } from "../../lib/stripeClient";

/** Necesitamos el body crudo (sin parsear) para verificar la firma de Stripe. */
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: any[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * POST /api/billing/webhook
 * Stripe llama esto en cada evento de la suscripción. Verifica la firma con
 * STRIPE_WEBHOOK_SECRET y actualiza `subscriptions` / `organizations.plan`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];
  if (!webhookSecret || !signature || typeof signature !== "string") {
    return res.status(400).json({ error: "Falta firma de Stripe o STRIPE_WEBHOOK_SECRET." });
  }

  const rawBody = await readRawBody(req);
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    return res.status(400).json({ error: `Firma de webhook inválida: ${err.message}` });
  }

  const supabase = getSupabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organization_id ?? session.client_reference_id;
      if (organizationId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscription(supabase, organizationId, subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organization_id;
      if (organizationId) {
        await upsertSubscription(supabase, organizationId, subscription);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organization_id;
      if (organizationId) {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
        await supabase.from("organizations").update({ plan: "free" }).eq("id", organizationId);
      }
      break;
    }
    default:
      break;
  }

  return res.status(200).json({ received: true });
}

async function upsertSubscription(supabase: any, organizationId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = planForPriceId(priceId);
  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? subscription.status
      : subscription.status === "past_due"
        ? "past_due"
        : "canceled";

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const row = {
    organization_id: organizationId,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    plan: plan ?? "free",
    status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("subscriptions").update(row).eq("id", existing.id);
  } else {
    await supabase.from("subscriptions").insert(row);
  }

  if (plan) {
    await supabase.from("organizations").update({ plan }).eq("id", organizationId);
  }
}
