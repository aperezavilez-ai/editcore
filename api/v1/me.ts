import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveDeveloperKey } from "../../lib/developerAuth";

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
  return res.status(200).json({ authenticated: true, scopes: key.scopes });
}
