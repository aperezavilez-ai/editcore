import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { decomposeGoal } from "../../../lib/taskReasoning";
import { checkGovernance } from "../../../lib/aiGovernance";

/**
 * POST /api/v1/network/supervisor
 * Master Supervisor Agent: coordina equipos, resuelve conflictos,
 * asigna tareas y optimiza distribucion de trabajo.
 *
 * Body: { goal, decision_type, context, team_id? }
 */

type DecisionType = "routing" | "conflict" | "optimization" | "escalation";

function buildDecision(
  decisionType: DecisionType,
  goal: string,
  context: Record<string, unknown>
): { decision: Record<string, unknown>; rationale: string } {
  if (decisionType === "routing") {
    const plan = decomposeGoal(goal);
    const agentLoads: Record<string, number> = {};
    for (const t of plan.subtasks) {
      agentLoads[t.agent] = (agentLoads[t.agent] ?? 0) + 1;
    }
    return {
      decision: {
        strategy: plan.strategy,
        subtasks: plan.subtasks,
        agent_loads: agentLoads,
        priority_order: plan.priority_order,
      },
      rationale: `Objetivo clasificado. Plan con ${plan.subtasks.length} subtareas distribuidas entre ${plan.estimated_agents.length} agentes.`,
    };
  }

  if (decisionType === "conflict") {
    const options = (context.options as string[]) ?? [];
    const selected = options[0] ?? "opcion-A";
    return {
      decision: {
        selected_option: selected,
        rejected_options: options.slice(1),
        resolution_strategy: "primera_opcion_valida",
      },
      rationale: "El supervisor selecciona la primera opcion viable cuando no hay criterios adicionales de comparacion.",
    };
  }

  if (decisionType === "optimization") {
    const agents = (context.agents as string[]) ?? [];
    const tasks = (context.tasks as string[]) ?? [];
    const perAgent = agents.length > 0 ? Math.ceil(tasks.length / agents.length) : tasks.length;
    return {
      decision: {
        distribution: agents.map((a, i) => ({
          agent: a,
          tasks: tasks.slice(i * perAgent, (i + 1) * perAgent),
        })),
        parallelizable: agents.length > 1,
      },
      rationale: `Distribucion uniforme: ~${perAgent} tarea(s) por agente para maximizar paralelismo.`,
    };
  }

  // escalation
  const gov = checkGovernance("api_call", (context.autonomy_level as number) ?? 1);
  return {
    decision: {
      escalated_to: "human_operator",
      current_autonomy_level: context.autonomy_level ?? 1,
      governance: gov,
      requires_human_approval: true,
    },
    rationale: "La accion excede el nivel de autonomia actual. Se escala al operador humano para aprobacion.",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const { goal, decision_type, context, team_id } = req.body ?? {};
  if (typeof goal !== "string" || !goal.trim()) {
    return res.status(400).json({ error: "Falta 'goal'." });
  }

  const dtype: DecisionType = ["routing", "conflict", "optimization", "escalation"].includes(decision_type)
    ? decision_type
    : "routing";

  const { decision, rationale } = buildDecision(dtype, goal.trim(), context ?? {});

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("supervisor_decisions")
    .insert({
      user_id: user.id,
      team_id: typeof team_id === "string" ? team_id : null,
      goal: goal.trim(),
      decision_type: dtype,
      context: context ?? {},
      decision,
      rationale,
    })
    .select("id, goal, decision_type, decision, rationale, created_at")
    .single();

  if (error) return res.status(500).json({ error: "No se pudo registrar la decision." });
  return res.status(201).json({ supervisor_decision: data });
}
