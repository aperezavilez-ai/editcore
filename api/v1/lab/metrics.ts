import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";

/**
 * GET /api/v1/lab/metrics — metricas del Innovation Center
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const supabase = getSupabaseAdmin();

  const [ideas, experiments, prototypes, research, trends, startups, memory] = await Promise.all([
    supabase.from("lab_ideas").select("status, potential").eq("user_id", user.id),
    supabase.from("lab_experiments").select("status").eq("user_id", user.id),
    supabase.from("lab_prototypes").select("status").eq("user_id", user.id),
    supabase.from("lab_research_reports").select("report_type").eq("user_id", user.id),
    supabase.from("lab_trend_signals").select("strength, opportunity_score").eq("user_id", user.id),
    supabase.from("lab_startups").select("status").eq("user_id", user.id),
    supabase.from("lab_innovation_memory").select("memory_type").eq("user_id", user.id),
  ]);

  const ideasData = ideas.data ?? [];
  const expsData = experiments.data ?? [];
  const protosData = prototypes.data ?? [];
  const trendsData = trends.data ?? [];

  return res.status(200).json({
    ideas: {
      total: ideasData.length,
      validated: ideasData.filter(i => i.status === "validated").length,
      building: ideasData.filter(i => i.status === "building").length,
      high_potential: ideasData.filter(i => i.potential === "high" || i.potential === "very_high").length,
    },
    experiments: {
      total: expsData.length,
      running: expsData.filter(e => e.status === "running").length,
      completed: expsData.filter(e => e.status === "completed").length,
      failed: expsData.filter(e => e.status === "failed").length,
    },
    prototypes: {
      total: protosData.length,
      building: protosData.filter(p => p.status === "building").length,
      done: protosData.filter(p => p.status === "done").length,
    },
    research: { total: research.data?.length ?? 0 },
    trends: {
      total: trendsData.length,
      growing: trendsData.filter(t => t.strength === "growing").length,
      avg_opportunity: trendsData.length
        ? Math.round(trendsData.reduce((a, t) => a + t.opportunity_score, 0) / trendsData.length)
        : 0,
    },
    startups: { total: startups.data?.length ?? 0, launched: startups.data?.filter(s => s.status === "launched").length ?? 0 },
    memory: { total: memory.data?.length ?? 0 },
  });
}
