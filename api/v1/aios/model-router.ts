import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { resolveDeveloperKey } from "../../../lib/developerAuth";
import { routeModel, routeByComplexity, type TaskType } from "../../../lib/modelRouter";

/**
 * POST /api/v1/aios/model-router
 * Recibe task_type y opcionalmente complexity_score.
 * Devuelve la recomendación de modelo IA para esa tarea.
 *
 * Acepta Bearer token (sesión) o x-editcore-api-key (developer key).
 * Body: { task_type: TaskType, complexity_score?: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  const devKey = !user ? await resolveDeveloperKey(req.headers["x-editcore-api-key"] as string | undefined) : null;
  if (!user && !devKey) return res.status(401).json({ error: "Token inválido o expirado." });

  const { task_type, complexity_score } = req.body ?? {};
  const validTypes: TaskType[] = [
    "architecture","code_generation","code_review","security_analysis",
    "test_generation","planning","documentation","summarization","simple_qa",
    "data_analysis","debugging",
  ];
  if (!validTypes.includes(task_type)) {
    return res.status(400).json({ error: `'task_type' inválido. Valores: ${validTypes.join(", ")}.` });
  }

  const recommendation = typeof complexity_score === "number"
    ? routeByComplexity(task_type as TaskType, complexity_score)
    : routeModel(task_type as TaskType);

  return res.status(200).json({ recommendation });
}
