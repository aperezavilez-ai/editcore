import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { browseMultiple } from "../../../lib/browserAgent";

/**
 * POST /api/v1/browser/extract
 * Body: { urls: string[] }
 *
 * Extrae contenido de hasta 5 URLs en paralelo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const { urls } = req.body ?? {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "Falta 'urls' (array de strings)." });
  }

  const results = await browseMultiple(urls);

  return res.status(200).json({
    results: results.map(r => ({
      url: r.url,
      title: r.title,
      text: r.text.slice(0, 5000),
      links: r.links,
      error: r.error,
    })),
    total: results.length,
  });
}
