import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET   /api/v1/enterprise/org-chart  — organigrama completo
 * POST  /api/v1/enterprise/org-chart  — agregar nodo al organigrama
 * PATCH /api/v1/enterprise/org-chart?id=...  — actualizar nodo
 */

const DEFAULT_ORG: Omit<object, never>[] = [
  { role_title: "CEO Agent",         agent_slug: "enterprise-consultant", department: "executive",   level: 1, parent_id: null, is_human: false },
  { role_title: "CTO Agent",         agent_slug: "enterprise-architect",  department: "technology",  level: 2, parent_id: null, is_human: false },
  { role_title: "Product Agent",     agent_slug: "product-manager",       department: "product",     level: 2, parent_id: null, is_human: false },
  { role_title: "AI Architect",      agent_slug: "ai-architect",          department: "technology",  level: 3, parent_id: null, is_human: false },
  { role_title: "Lead Developer",    agent_slug: "saas-builder",          department: "engineering", level: 3, parent_id: null, is_human: false },
  { role_title: "QA Lead",           agent_slug: "test-factory",          department: "engineering", level: 3, parent_id: null, is_human: false },
  { role_title: "Security Analyst",  agent_slug: "maintenance-agent",     department: "security",    level: 3, parent_id: null, is_human: false },
  { role_title: "Release Manager",   agent_slug: "release-manager",       department: "operations",  level: 3, parent_id: null, is_human: false },
  { role_title: "Sprint Planner",    agent_slug: "sprint-planner",        department: "operations",  level: 3, parent_id: null, is_human: false },
  { role_title: "Finance Analyst",   agent_slug: "cost-analyst",          department: "finance",     level: 3, parent_id: null, is_human: false },
  { role_title: "Risk Analyst",      agent_slug: "risk-analyst",          department: "risk",        level: 3, parent_id: null, is_human: false },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("biz_org_chart")
      .select("id, role_title, agent_slug, department, level, parent_id, is_human, description, created_at")
      .eq("user_id", user.id)
      .order("level", { ascending: true })
      .order("department", { ascending: true });

    if (error) return res.status(500).json({ error: "No se pudo obtener el organigrama." });

    // Si no hay nodos, crear el organigrama por defecto
    if (!data?.length && req.query.init === "true") {
      const rows = DEFAULT_ORG.map(n => ({ ...n, user_id: user.id }));
      const { data: created } = await supabase.from("biz_org_chart").insert(rows).select("id, role_title, department, level");
      return res.status(200).json({ org_chart: created ?? [], initialized: true });
    }

    return res.status(200).json({ org_chart: data ?? [] });
  }

  if (req.method === "POST") {
    const { role_title, agent_slug, department, level, parent_id, is_human, description } = req.body ?? {};
    if (typeof role_title !== "string" || !role_title.trim()) {
      return res.status(400).json({ error: "Falta 'role_title'." });
    }
    const { data, error } = await supabase
      .from("biz_org_chart")
      .insert({
        user_id: user.id,
        role_title: role_title.trim(),
        agent_slug: agent_slug ?? null,
        department: department ?? "general",
        level: typeof level === "number" ? Math.min(5, Math.max(1, level)) : 3,
        parent_id: parent_id ?? null,
        is_human: is_human === true,
        description: description ?? null,
      })
      .select("id, role_title, agent_slug, department, level")
      .single();
    if (error) return res.status(500).json({ error: "No se pudo crear el nodo." });
    return res.status(201).json({ node: data });
  }

  if (req.method === "PATCH") {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) return res.status(400).json({ error: "Falta 'id'." });
    const allowed = ["role_title", "agent_slug", "department", "level", "parent_id", "is_human", "description"];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    const { data, error } = await supabase
      .from("biz_org_chart")
      .update(updates)
      .eq("id", id).eq("user_id", user.id)
      .select("id, role_title, level").single();
    if (error) return res.status(500).json({ error: "No se pudo actualizar el nodo." });
    return res.status(200).json({ node: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
