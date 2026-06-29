import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET  /api/v1/architect/projects — proyectos de arquitectura del usuario.
 * POST /api/v1/architect/projects — guarda un nuevo proyecto de arquitectura.
 *
 * Permite persistir el output generado por el agente @enterprise-architect
 * (BRD, SOLUTION_ARCHITECTURE, AI_ARCHITECTURE, roadmap, costo, riesgos)
 * para referencia futura o re-uso. Requiere sesión de Supabase Auth.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token inválido o expirado." });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("architecture_projects")
      .select("id, name, business_requirements, solution_architecture, ai_architecture, implementation_roadmap, cost_estimate, risk_report, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ error: "No se pudieron listar los proyectos." });
    return res.status(200).json({ projects: data });
  }

  if (req.method === "POST") {
    const { name, business_requirements, solution_architecture, ai_architecture, implementation_roadmap, cost_estimate, risk_report } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Falta 'name'." });
    const { data, error } = await supabase
      .from("architecture_projects")
      .insert({ user_id: user.id, name: name.trim(), business_requirements: business_requirements ?? null, solution_architecture: solution_architecture ?? null, ai_architecture: ai_architecture ?? null, implementation_roadmap: implementation_roadmap ?? null, cost_estimate: cost_estimate ?? null, risk_report: risk_report ?? null })
      .select("id, name, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo guardar el proyecto." });
    return res.status(201).json({ project: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
