import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveDeveloperKey, hasScope, checkRateLimit } from "../../lib/developerAuth";

/**
 * GET /api/v1/me — primer endpoint real de la API pública de EditCore
 * (ver docs/EDITCORE_API_PLATFORM.md). Requiere `x-editcore-api-key`
 * generada en /api/developer/keys. Confirma que la clave es válida y
 * devuelve los scopes asociados; es la base para futuros endpoints
 * versionados (/api/v1/...).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = await resolveDeveloperKey(req.headers["x-editcore-api-key"] as string | undefined);
  if (!key) {
    return res.status(401).json({ error: "API key inválida, inactiva o expirada." });
  }
  if (!hasScope(key, "api:read")) {
    return res.status(403).json({ error: "La clave no tiene el scope api:read." });
  }
  const { allowed, remaining } = checkRateLimit(key);
  res.setHeader("X-RateLimit-Limit", String(key.rateLimitPerMinute));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(remaining, 0)));
  if (!allowed) {
    return res.status(429).json({ error: "Límite de solicitudes por minuto excedido." });
  }
  return res.status(200).json({ authenticated: true, scopes: key.scopes });
}
