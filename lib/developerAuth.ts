import { randomBytes, createHash } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

const KEY_PREFIX = "ec_live_";

export function generateDeveloperApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = KEY_PREFIX + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  return { rawKey, keyHash, keyPrefix: rawKey.slice(0, KEY_PREFIX.length + 6) };
}

export interface DeveloperKeyContext {
  id: string;
  userId: string;
  scopes: string[];
  rateLimitPerMinute: number;
}

/**
 * Resuelve una developer API key (header `x-editcore-api-key`) contra
 * developer_api_keys. Devuelve undefined si no existe, está inactiva o expiró.
 */
export async function resolveDeveloperKey(rawKey: string | undefined): Promise<DeveloperKeyContext | undefined> {
  if (!rawKey?.trim()) return undefined;
  const keyHash = createHash("sha256").update(rawKey.trim()).digest("hex");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("developer_api_keys")
    .select("id, user_id, scopes, is_active, expires_at, rate_limit_per_minute")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !data || !data.is_active) return undefined;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return undefined;

  void supabase
    .from("developer_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  return {
    id: data.id,
    userId: data.user_id,
    scopes: data.scopes ?? [],
    rateLimitPerMinute: data.rate_limit_per_minute ?? 60,
  };
}

export function hasScope(key: DeveloperKeyContext, scope: string): boolean {
  return key.scopes.includes(scope);
}

/**
 * Rate limit por instancia de función serverless (ventana fija de 60s, en
 * memoria del proceso). No es un límite global distribuido entre todas las
 * instancias de Vercel — eso requeriría un store compartido (ej. Upstash
 * Redis), que todavía no existe en EditCore. Es real, pero parcial: limita
 * el tráfico que pasa por cada instancia, no el total absoluto de la clave.
 */
const requestCounts = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(key: DeveloperKeyContext): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = requestCounts.get(key.id);
  if (!entry || now - entry.windowStart >= windowMs) {
    requestCounts.set(key.id, { count: 1, windowStart: now });
    return { allowed: true, remaining: key.rateLimitPerMinute - 1 };
  }
  entry.count += 1;
  if (entry.count > key.rateLimitPerMinute) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: key.rateLimitPerMinute - entry.count };
}
