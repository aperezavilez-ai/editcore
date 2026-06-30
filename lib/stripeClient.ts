import Stripe from "stripe";

let cached: Stripe | undefined;

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

/** Mapea un plan de EditCore al ID de Price de Stripe (configurado por variable de entorno). */
export function priceIdForPlan(plan: string): string | undefined {
  const map: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    team: process.env.STRIPE_PRICE_TEAM,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  return map[plan];
}

/** Mapea un Price ID de Stripe de vuelta al plan de EditCore, para procesar webhooks. */
export function planForPriceId(priceId: string | undefined): string | undefined {
  if (!priceId) return undefined;
  const pairs: Array<[string, string | undefined]> = [
    ["starter", process.env.STRIPE_PRICE_STARTER],
    ["professional", process.env.STRIPE_PRICE_PROFESSIONAL],
    ["team", process.env.STRIPE_PRICE_TEAM],
    ["enterprise", process.env.STRIPE_PRICE_ENTERPRISE],
  ];
  return pairs.find(([, id]) => id === priceId)?.[0];
}
