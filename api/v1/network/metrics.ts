import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET /api/v1/network/metrics
 * Metricas globales de la red de agentes para el Network Center dashboard.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [teams, messages, nodes, edges, research, quality] = await Promise.all([
    supabase.from("agent_teams").select("team_type, status").eq("user_id", user.id),
    supabase.from("agent_messages").select("msg_type, status").eq("user_id", user.id).gte("created_at", since),
    supabase.from("knowledge_nodes").select("node_type").or(`is_public.eq.true,user_id.eq.${user.id}`),
    supabase.from("knowledge_edges").select("relation_type", { count: "exact", head: true }),
    supabase.from("research_reports").select("quality_score").gte("created_at", since),
    supabase.from("quality_reviews").select("overall_score, approved").eq("user_id", user.id).gte("created_at", since),
  ]);

  const teamStats = { total: 0, active: 0, by_type: {} as Record<string, number> };
  for (const t of teams.data ?? []) {
    teamStats.total++;
    if (t.status === "active") teamStats.active++;
    teamStats.by_type[t.team_type] = (teamStats.by_type[t.team_type] ?? 0) + 1;
  }

  const msgStats = { total: 0, by_type: {} as Record<string, number> };
  for (const m of messages.data ?? []) {
    msgStats.total++;
    msgStats.by_type[m.msg_type] = (msgStats.by_type[m.msg_type] ?? 0) + 1;
  }

  const nodeStats = { total: 0, by_type: {} as Record<string, number> };
  for (const n of nodes.data ?? []) {
    nodeStats.total++;
    nodeStats.by_type[n.node_type] = (nodeStats.by_type[n.node_type] ?? 0) + 1;
  }

  const qualityScores = (quality.data ?? []).map(q => q.overall_score);
  const avgQuality = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : 0;

  return res.status(200).json({
    period: "last_24h",
    teams: teamStats,
    messages: msgStats,
    knowledge: {
      nodes: nodeStats,
      edges: edges.count ?? 0,
    },
    research: {
      reports_24h: (research.data ?? []).length,
    },
    quality: {
      reviews_24h: qualityScores.length,
      avg_score: avgQuality,
      approved: (quality.data ?? []).filter(q => q.approved).length,
    },
  });
}
