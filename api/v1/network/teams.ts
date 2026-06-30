import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/network/teams?project_id=...  — equipos del usuario
 * POST  /api/v1/network/teams                 — crear equipo
 * PATCH /api/v1/network/teams?id=...          — actualizar equipo
 */

const TEAM_TEMPLATES: Record<string, { description: string; members: { agent: string; role: string }[] }> = {
  development: {
    description: "Equipo de desarrollo de software completo.",
    members: [
      { agent: "enterprise-architect", role: "Arquitecto IA" },
      { agent: "saas-builder",         role: "Backend Agent" },
      { agent: "saas-builder",         role: "Frontend Agent" },
      { agent: "test-factory",         role: "QA Agent" },
      { agent: "maintenance-agent",    role: "Security Agent" },
      { agent: "release-manager",      role: "DevOps Agent" },
    ],
  },
  business: {
    description: "Equipo de analisis y estrategia de negocio.",
    members: [
      { agent: "product-manager",      role: "Product Agent" },
      { agent: "enterprise-consultant",role: "Estrategia Agent" },
      { agent: "cost-analyst",         role: "Finanzas Agent" },
      { agent: "risk-analyst",         role: "Analista Agent" },
    ],
  },
  research: {
    description: "Equipo de investigacion de tecnologias y tendencias.",
    members: [
      { agent: "ai-architect",         role: "AI Research Agent" },
      { agent: "enterprise-architect", role: "Tech Scout Agent" },
      { agent: "maintenance-agent",    role: "Security Research Agent" },
    ],
  },
  quality: {
    description: "Equipo de control de calidad global.",
    members: [
      { agent: "test-factory",         role: "Code Quality Agent" },
      { agent: "maintenance-agent",    role: "Security QA Agent" },
      { agent: "enterprise-architect", role: "Architecture QA Agent" },
      { agent: "release-manager",      role: "Performance QA Agent" },
    ],
  },
  enterprise: {
    description: "Equipo enterprise con agentes privados y memoria aislada.",
    members: [
      { agent: "enterprise-architect", role: "Enterprise Architect" },
      { agent: "enterprise-consultant",role: "Enterprise Consultant" },
      { agent: "sprint-planner",       role: "Project Manager Agent" },
    ],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const projectId = typeof req.query.project_id === "string" ? req.query.project_id : undefined;
    let q = supabase
      .from("agent_teams")
      .select("id, name, team_type, description, members, status, project_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: "No se pudieron listar los equipos." });
    return res.status(200).json({ teams: data });
  }

  if (req.method === "POST") {
    const { name, team_type, description, project_id, members } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Falta 'name'." });
    }
    const type = team_type ?? "development";
    const template = TEAM_TEMPLATES[type];
    const resolvedMembers = Array.isArray(members) ? members : (template?.members ?? []);
    const { data, error } = await supabase
      .from("agent_teams")
      .insert({
        user_id: user.id,
        name: name.trim(),
        team_type: type,
        description: description ?? template?.description ?? null,
        project_id: typeof project_id === "string" ? project_id : null,
        members: resolvedMembers,
      })
      .select("id, name, team_type, members, status, created_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el equipo." });
    return res.status(201).json({ team: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const allowed = ["name", "description", "members", "status"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    const { data, error } = await supabase
      .from("agent_teams")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, status, updated_at")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el equipo." });
    return res.status(200).json({ team: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
