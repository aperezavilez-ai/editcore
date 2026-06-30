import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { decomposeGoal } from "../../../lib/taskReasoning";
import { checkGovernance } from "../../../lib/aiGovernance";

/**
 * POST /api/v1/aios/orchestrate
 * Recibe un objetivo, lo descompone en un plan de subtareas,
 * guarda el plan en ai_orchestration_runs + ai_task_plans y lo devuelve.
 *
 * Body: { goal: string, project_id?: string, autonomy_level?: 1-5 }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  const { goal, project_id, autonomy_level } = req.body ?? {};
  if (typeof goal !== "string" || !goal.trim()) {
    return res.status(400).json({ error: "Falta 'goal'." });
  }

  const level = typeof autonomy_level === "number"
    ? Math.min(5, Math.max(1, Math.floor(autonomy_level)))
    : 1;

  // Validar que el usuario puede iniciar una orquestación
  const gov = checkGovernance("api_call", level);
  if (!gov.allowed) {
    return res.status(403).json({ error: gov.reason });
  }

  const plan = decomposeGoal(goal.trim());
  const supabase = getSupabaseAdmin();

  // Crear el run de orquestación
  const { data: run, error: runErr } = await supabase
    .from("ai_orchestration_runs")
    .insert({
      user_id: user.id,
      project_id: typeof project_id === "string" ? project_id : null,
      goal: goal.trim(),
      status: "planning",
      autonomy_level: level,
      agent_sequence: plan.subtasks.map(s => ({ id: s.id, agent: s.agent, title: s.title })),
      current_step: 0,
    })
    .select("id, goal, status, autonomy_level, created_at")
    .single();

  if (runErr) return res.status(500).json({ error: "No se pudo crear el run de orquestación." });

  // Guardar el plan de tareas
  await supabase.from("ai_task_plans").insert({
    orchestration_run_id: run.id,
    user_id: user.id,
    goal: goal.trim(),
    strategy: plan.strategy,
    subtasks: plan.subtasks,
    priority_order: plan.priority_order,
    status: "pending",
  });

  return res.status(201).json({
    run,
    plan: {
      strategy: plan.strategy,
      complexity_score: plan.complexity_score,
      subtasks: plan.subtasks,
      priority_order: plan.priority_order,
      estimated_agents: plan.estimated_agents,
    },
  });
}
