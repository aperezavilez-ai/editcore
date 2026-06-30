import Stripe from "stripe";

let cached: Stripe | undefined;

export type BillingInterval = "monthly" | "annual";

/** Cliente de Stripe server-side. Lanza si falta STRIPE_SECRET_KEY (nunca hardcodeada). */
export function getStripe(): Stripe {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Falta STRIPE_SECRET_KEY en las variables de entorno.");
  }
  cached = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  return cached;
}

/** Único plan pago de EditCore ("pro"), facturable mensual ($19) o anual ($182.40, -20%). */
export function priceIdForInterval(interval: BillingInterval): string | undefined {
  return interval === "annual" ? process.env.STRIPE_PRICE_PRO_ANNUAL : process.env.STRIPE_PRICE_PRO_MONTHLY;
}

/** Mapea un Price ID de Stripe de vuelta a la frecuencia de facturación, para procesar webhooks. */
export function intervalForPriceId(priceId: string | undefined): BillingInterval | undefined {
  if (!priceId) return undefined;
  if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return "monthly";
  return undefined;
}
