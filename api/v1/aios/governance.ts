import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { checkGovernance, AUTONOMY_LEVELS, type ActionType } from "../../../lib/aiGovernance";

/**
 * GET  /api/v1/aios/governance           — reglas base + niveles de autonomía
 * POST /api/v1/aios/governance/check     — verifica si una acción está permitida
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  if (req.method === "GET") {
    const supabase = getSupabaseAdmin();
    const { data: rules } = await supabase
      .from("ai_governance_rules")
      .select("id, scope, agent_slug, action_type, allowed, requires_approval, min_autonomy_level, description")
      .order("min_autonomy_level", { ascending: true });

    return res.status(200).json({
      autonomy_levels: AUTONOMY_LEVELS,
      rules: rules ?? [],
    });
  }

  if (req.method === "POST") {
    const { action, autonomy_level, agent_slug } = req.body ?? {};
    if (typeof action !== "string") return res.status(400).json({ error: "Falta 'action'." });
    const level = typeof autonomy_level === "number" ? Math.min(5, Math.max(1, autonomy_level)) : 1;
    const result = checkGovernance(action as ActionType, level, agent_slug);
    return res.status(200).json({ result });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
