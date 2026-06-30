import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { decomposeGoal } from "../../../lib/taskReasoning";

/**
 * POST /api/v1/aios/task-plan
 * Descompone un objetivo en subtareas sin crear un run de orquestación.
 * Útil para previsualizar el plan antes de ejecutar.
 *
 * Body: { goal: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  const { goal } = req.body ?? {};
  if (typeof goal !== "string" || !goal.trim()) {
    return res.status(400).json({ error: "Falta 'goal'." });
  }

  const plan = decomposeGoal(goal.trim());
  return res.status(200).json({ plan });
}
