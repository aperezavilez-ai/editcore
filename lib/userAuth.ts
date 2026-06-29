import { getSupabaseAdmin } from "./supabaseAdmin";

export interface AuthenticatedUser {
  id: string;
  email: string | undefined;
}

/**
 * Valida el JWT de Supabase Auth que manda el cliente en `Authorization: Bearer <token>`.
 * No confía en el contenido del token sin verificarlo contra Supabase (auth.getUser).
 */
export async function resolveUserFromBearerToken(
  authHeader: string | undefined
): Promise<AuthenticatedUser | undefined> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
  if (!token) return undefined;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return undefined;

  return { id: data.user.id, email: data.user.email };
}

export interface UserProfile {
  organization_id: string | null;
  full_name: string | null;
  role: string;
}

export async function getProfile(userId: string): Promise<UserProfile | undefined> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return undefined;
  return data as UserProfile;
}
