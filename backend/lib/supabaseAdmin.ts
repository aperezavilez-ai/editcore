import { createClient } from "@supabase/supabase-js";

let cached: any;

/** Cliente con service_role: solo se usa server-side, nunca se expone al cliente/extensión. */
export function getSupabaseAdmin(): any {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  }
  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
}
