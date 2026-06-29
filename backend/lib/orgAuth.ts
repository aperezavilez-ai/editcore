import { createHash } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Resuelve el organization_id a partir de la key opaca que manda la extensión
 * en el header `x-editcore-org-key`. Devuelve undefined si la key no existe o
 * fue revocada (401 en el endpoint que llama a esto).
 */
export async function resolveOrganizationFromKey(rawKey: string | undefined): Promise<string | undefined> {
  if (!rawKey?.trim()) return undefined;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("organization_api_keys")
    .select("organization_id, revoked_at")
    .eq("key_hash", hashKey(rawKey.trim()))
    .maybeSingle();
  if (error || !data || data.revoked_at) return undefined;
  return data.organization_id as string;
}

export { hashKey };
