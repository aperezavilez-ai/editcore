import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { searchWeb, browseUrl } from "../../../lib/browserAgent";

/**
 * POST /api/v1/browser/search
 * Body: { query: string, deep?: boolean, max_results?: number }
 *
 * Busca en DuckDuckGo. Con deep:true visita las primeras paginas y extrae contenido completo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const { query, deep = false, max_results = 8 } = req.body ?? {};
  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Falta 'query'." });
  }

  const results = await searchWeb(query.trim(), Math.min(max_results, 10));

  if (!deep) {
    return res.status(200).json({ query, results, total: results.length });
  }

  // Modo deep: visita las primeras 3 paginas y extrae contenido
  const topUrls = results.slice(0, 3).map(r => r.url).filter(Boolean);
  const pages = await Promise.all(topUrls.map(url => browseUrl(url, false)));

  return res.status(200).json({
    query,
    results,
    total: results.length,
    deep_content: pages.map(p => ({
      url: p.url,
      title: p.title,
      text: p.text.slice(0, 3000),
      error: p.error,
    })),
  });
}
