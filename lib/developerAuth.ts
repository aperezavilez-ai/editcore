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
    .select("id, user_id, scopes, is_active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !data || !data.is_active) return undefined;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return undefined;

  void supabase
    .from("developer_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  return { id: data.id, userId: data.user_id, scopes: data.scopes ?? [] };
}
