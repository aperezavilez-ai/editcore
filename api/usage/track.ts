import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { resolveOrganizationFromKey } from "../../lib/orgAuth";

/**
 * POST /api/usage/track
 * La extensión EditCore llama esto solo si el usuario activó "sincronizar
 * consumo con mi organización" (opt-in real, no por defecto). Sin esa
 * activación, el tracking sigue siendo 100% local (apiKeyService.ts).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orgId = await resolveOrganizationFromKey(req.headers["x-editcore-org-key"] as string | undefined);
  if (!orgId) {
    return res.status(401).json({ error: "Organization key inválida o revocada." });
  }

  const { provider, model, inputTokens, outputTokens, estimatedCostUsd, toolName, projectLabel } = req.body ?? {};
  if (!provider || !model) {
    return res.status(400).json({ error: "provider y model son requeridos." });
  }

  const supabase = getSupabaseAdmin();

  const { data: org } = await supabase.from("organizations").select("plan").eq("id", orgId).single();
  const { data: limits } = await supabase
    .from("plan_limits")
    .select("monthly_token_limit")
    .eq("plan", org?.plan ?? "free")
    .single();

  if (limits) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: events } = await supabase
      .from("usage_events")
      .select("input_tokens, output_tokens")
      .eq("organization_id", orgId)
      .gte("created_at", startOfMonth.toISOString());
    const tokensUsed = (events ?? []).reduce(
      (sum: number, e: any) => sum + (e.input_tokens ?? 0) + (e.output_tokens ?? 0),
      0
    );
    if (tokensUsed >= limits.monthly_token_limit) {
      return res.status(402).json({
        error: "Límite mensual de tokens del plan superado. Actualizá tu plan para seguir reportando consumo.",
        overLimit: true,
      });
    }
  }

  const { error } = await supabase.from("usage_events").insert({
    organization_id: orgId,
    provider,
    model,
    input_tokens: inputTokens ?? 0,
    output_tokens: outputTokens ?? 0,
    estimated_cost_usd: estimatedCostUsd ?? 0,
    tool_name: toolName ?? null,
    project_label: projectLabel ?? null,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(204).end();
}
