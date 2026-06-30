import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { checkGovernance } from "../../../lib/aiGovernance";
import { generateReasoning, isLlmConfigured } from "../../../lib/llmClient";

interface Subtask {
  id: string;
  title: string;
  description: string;
  agent: string;
  task_type: string;
  requires_human_approval: boolean;
}

interface StepResult {
  subtask_id: string;
  title: string;
  output: string;
  llm_reasoning_used: boolean;
}

/**
 * POST /api/v1/aios/execute
 * Avanza un run de orquestación un paso a la vez, respetando el Trust
 * Framework: si la siguiente subtarea requiere aprobación humana, el run
 * queda en status 'paused' (esperando aprobación) y no avanza hasta que el
 * caller reenvíe la misma petición con `{ approved: true }`.
 *
 * No ejecuta acciones destructivas reales (no escribe archivos, no
 * deployea) — cada paso solo produce un resultado de razonamiento/análisis
 * textual, usando el LLM real si está configurado o un resumen basado en
 * reglas fijas si no lo está.
 *
 * Body: { run_id: string, approved?: boolean }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  const { run_id, approved } = req.body ?? {};
  if (typeof run_id !== "string" || !run_id) {
    return res.status(400).json({ error: "Falta 'run_id'." });
  }

  const supabase = getSupabaseAdmin();

  const { data: run, error: runErr } = await supabase
    .from("ai_orchestration_runs")
    .select("id, goal, status, autonomy_level, current_step, result")
    .eq("id", run_id)
    .eq("user_id", user.id)
    .single();

  if (runErr || !run) return res.status(404).json({ error: "Run no encontrado." });

  if (!["planning", "running", "paused"].includes(run.status)) {
    return res.status(400).json({ error: `El run está en estado '${run.status}'; no se puede ejecutar.` });
  }

  const gov = checkGovernance("api_call", run.autonomy_level);
  if (!gov.allowed) {
    return res.status(403).json({ error: gov.reason });
  }

  const { data: planRow, error: planErr } = await supabase
    .from("ai_task_plans")
    .select("subtasks, priority_order")
    .eq("orchestration_run_id", run_id)
    .single();

  if (planErr || !planRow) return res.status(404).json({ error: "Plan de tareas no encontrado para este run." });

  const subtasks = (planRow.subtasks ?? []) as Subtask[];
  const priorityOrder = (planRow.priority_order ?? []) as string[];
  const currentStep = run.current_step ?? 0;

  if (currentStep >= priorityOrder.length) {
    const { data: completedRun } = await supabase
      .from("ai_orchestration_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", run_id)
      .select("id, status, current_step, completed_at")
      .single();
    return res.status(200).json({ run: completedRun, done: true });
  }

  const subtaskId = priorityOrder[currentStep];
  const subtask = subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return res.status(500).json({ error: `Subtarea '${subtaskId}' no encontrada en el plan.` });

  if (subtask.requires_human_approval && !approved) {
    const { data: pausedRun } = await supabase
      .from("ai_orchestration_runs")
      .update({ status: "paused" })
      .eq("id", run_id)
      .select("id, status, current_step")
      .single();
    return res.status(200).json({
      run: pausedRun,
      needs_approval: true,
      pending_subtask: subtask,
    });
  }

  let output = `Subtarea '${subtask.title}' procesada por reglas fijas (sin LLM configurado): ${subtask.description}`;
  let llmUsed = false;
  if (isLlmConfigured()) {
    const reasoning = await generateReasoning(
      `Objetivo general: "${run.goal}"\n\nSubtarea actual: "${subtask.title}" — ${subtask.description}\n\n` +
        `Redacta en 2-4 frases el resultado/análisis de completar esta subtarea, en español.`,
      { maxTokens: 400 }
    );
    if (reasoning) {
      output = reasoning.text.trim();
      llmUsed = true;
    }
  }

  const existingResults: StepResult[] = (() => {
    if (!run.result) return [];
    try {
      const parsed = JSON.parse(run.result);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const newResults = [
    ...existingResults,
    { subtask_id: subtask.id, title: subtask.title, output, llm_reasoning_used: llmUsed } satisfies StepResult,
  ];

  const nextStep = currentStep + 1;
  const isLastStep = nextStep >= priorityOrder.length;

  const { data: updatedRun, error: updateErr } = await supabase
    .from("ai_orchestration_runs")
    .update({
      status: isLastStep ? "completed" : "running",
      current_step: nextStep,
      result: JSON.stringify(newResults),
      completed_at: isLastStep ? new Date().toISOString() : null,
    })
    .eq("id", run_id)
    .select("id, status, current_step, result, completed_at")
    .single();

  if (updateErr) return res.status(500).json({ error: "No se pudo actualizar el run." });

  return res.status(200).json({
    run: updatedRun,
    step_result: newResults[newResults.length - 1],
    done: isLastStep,
  });
}
