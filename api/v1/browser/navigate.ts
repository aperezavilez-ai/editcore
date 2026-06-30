import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveUserFromBearerToken } from "../../../lib/userAuth";
import { browseUrl } from "../../../lib/browserAgent";

/**
 * POST /api/v1/browser/navigate
 * Body: { url: string, screenshot?: boolean }
 *
 * Navega a una URL y devuelve titulo, texto y links.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await resolveUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Token invalido o expirado." });

  const { url, screenshot = false } = req.body ?? {};
  if (typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({ error: "Falta 'url' valida (debe comenzar con http)." });
  }

  const result = await browseUrl(url, screenshot === true);

  if (result.error) {
    return res.status(502).json({ error: "No se pudo navegar a la URL.", detail: result.error });
  }

  return res.status(200).json({
    url: result.url,
    title: result.title,
    text: result.text,
    links: result.links,
    screenshot_base64: result.screenshot_base64,
  });
}
