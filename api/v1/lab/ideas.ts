import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/lab/ideas?status=...&category=...  — listar ideas
 * POST /api/v1/lab/ideas                          — crear idea
 * PATCH /api/v1/lab/ideas                         — actualizar idea (status, validation_scores)
 */

const VALIDATION_DIMENSIONS = ["demand", "competition", "cost", "technical_feasibility", "commercial_potential"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { status, category } = req.query;
    let q = supabase
      .from("lab_ideas")
      .select("id, title, problem, solution, market, complexity, potential, category, status, validation_scores, tags, generated_by, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (typeof status === "string") q = q.eq("status", status);
    if (typeof category === "string") q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar las ideas." });
    return res.status(200).json({ ideas: data });
  }

  if (req.method === "POST") {
    const { title, problem, solution, market, complexity, potential, category, tags, generated_by } = req.body ?? {};
    if (!title?.trim() || !problem?.trim() || !solution?.trim() || !market?.trim()) {
      return res.status(400).json({ error: "Faltan campos requeridos: title, problem, solution, market." });
    }
    const { data, error } = await supabase
      .from("lab_ideas")
      .insert({
        user_id: user.id,
        title: title.trim(),
        problem: problem.trim(),
        solution: solution.trim(),
        market: market.trim(),
        complexity: complexity ?? "medium",
        potential: potential ?? "medium",
        category: category ?? "feature",
        tags: Array.isArray(tags) ? tags : [],
        generated_by: generated_by ?? "manual",
      })
      .select("id, title, complexity, potential, status, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear la idea." });
    return res.status(201).json({ idea: data });
  }

  if (req.method === "PATCH") {
    const { id, status, validation_scores, complexity, potential, tags } = req.body ?? {};
    if (typeof id !== "string") return res.status(400).json({ error: "Falta 'id'." });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (complexity) updates.complexity = complexity;
    if (potential) updates.potential = potential;
    if (Array.isArray(tags)) updates.tags = tags;
    if (validation_scores && typeof validation_scores === "object") {
      // Calcular score promedio de las dimensiones de validacion
      const scores = VALIDATION_DIMENSIONS.map(d => Number(validation_scores[d] ?? 0));
      const avg = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);
      updates.validation_scores = { ...validation_scores, overall: avg };
      // Auto-update status segun score
      if (!status) {
        if (avg >= 70) updates.status = "validated";
        else if (avg < 40) updates.status = "rejected";
        else updates.status = "validating";
      }
    }
    const { data, error } = await supabase
      .from("lab_ideas")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, status, validation_scores, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar la idea." });
    return res.status(200).json({ idea: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
