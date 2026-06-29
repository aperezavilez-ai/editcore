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
