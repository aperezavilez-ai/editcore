import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

/**
 * GET /api/evolution/audit?kind=daily|weekly|monthly
 *
 * Auditoría real (Prompt 12, Fase 2): cuenta recursos reales del sistema
 * (no simulados) y guarda el resultado en evolution_audits. Pensado para
 * ser invocado por Vercel Cron (ver vercel.json). Protegido con
 * CRON_SECRET para que no cualquiera pueda dispararlo ni inflar métricas.
 *
 * Deliberadamente NO genera código ni decide cambios por sí mismo — solo
 * mide. Las propuestas de mejora se crean por separado en
 * evolution_proposals (ver /api/evolution/proposals), revisadas por un
 * humano (Fase 14: seguridad de automejora).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const kind = (req.query.kind as string) || "daily";
  if (!["daily", "weekly", "monthly"].includes(kind)) {
    return res.status(400).json({ error: "kind debe ser daily, weekly o monthly." });
  }

  const supabase = getSupabaseAdmin();

  const [organizations, profiles, developerKeys, agents, posts, comments, proposals] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("developer_api_keys").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("agent_definitions").select("id", { count: "exact", head: true }),
    supabase.from("community_posts").select("id", { count: "exact", head: true }),
    supabase.from("community_comments").select("id", { count: "exact", head: true }),
    supabase.from("evolution_proposals").select("id", { count: "exact", head: true }).eq("status", "proposed"),
  ]);

  const metrics = {
    organizations: organizations.count ?? 0,
    users: profiles.count ?? 0,
    active_developer_keys: developerKeys.count ?? 0,
    public_and_private_agents: agents.count ?? 0,
    community_posts: posts.count ?? 0,
    community_comments: comments.count ?? 0,
    open_proposals: proposals.count ?? 0,
    measured_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("evolution_audits")
    .insert({ kind, metrics })
    .select("id, kind, metrics, created_at")
    .single();
  if (error) return res.status(500).json({ error: "No se pudo guardar la auditoría." });

  return res.status(200).json({ audit: data });
}
