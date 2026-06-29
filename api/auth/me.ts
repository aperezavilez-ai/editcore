import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveUserFromBearerToken, getProfile } from "../../lib/userAuth";

/**
 * GET /api/auth/me — primer endpoint real de autenticación de usuario individual
 * (prerrequisito de Community/Creator Program, ver EDITCORE_ECOSYSTEM_ARCHITECTURE.md).
 * Requiere `Authorization: Bearer <access_token>` de una sesión de Supabase Auth.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }

  const profile = await getProfile(user.id);
  if (!profile?.organization_id) {
    return res.status(200).json({ user, profile: profile ?? null, organization: null });
  }

  const supabase = getSupabaseAdmin();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, plan, created_at")
    .eq("id", profile.organization_id)
    .maybeSingle();

  return res.status(200).json({ user, profile, organization: organization ?? null });
}
