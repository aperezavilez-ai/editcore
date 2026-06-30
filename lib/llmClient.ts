/**
 * Cliente opcional para invocar la API de Claude (Anthropic) desde el
 * orquestador. Si no hay API key configurada, `isLlmConfigured()` devuelve
 * false y el caller debe usar el modo de reglas fijas como fallback — esta
 * función nunca debe ser obligatoria para que el orquestador funcione.
 *
 * La API key se lee de la variable de entorno ANTHROPIC_API_KEY, configurada
 * por el usuario en su propio dashboard de Vercel. Nunca se escribe ni se
 * referencia un valor de API key en este repositorio.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface LlmReasoningResult {
  text: string;
  model: string;
}

/**
 * Pide a Claude una respuesta de texto libre para un prompt dado.
 * Devuelve null si no hay API key configurada o si la llamada falla —
 * el caller decide si usar el fallback de reglas fijas en ese caso.
 */
export async function generateReasoning(
  prompt: string,
  options?: { maxTokens?: number; model?: string }
): Promise<LlmReasoningResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = options?.model ?? DEFAULT_MODEL;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens ?? 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((b) => b.type === "text")?.text;
    if (!text) return null;

    return { text, model };
  } catch {
    return null;
  }
}
