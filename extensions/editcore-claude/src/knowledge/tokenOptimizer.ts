/**
 * Token optimizer — Fase 13 (Prompt 5).
 */
import type { RagHit } from "./types";

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function pruneHits(hits: RagHit[], maxTokens: number): RagHit[] {
  const result: RagHit[] = [];
  let used = 0;
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  for (const hit of sorted) {
    const cost = estimateTokens(hit.text);
    if (used + cost > maxTokens) {
      if (result.length === 0) {
        result.push({
          ...hit,
          text: hit.text.slice(0, maxTokens * CHARS_PER_TOKEN),
        });
      }
      break;
    }
    result.push(hit);
    used += cost;
  }
  return result;
}

export function formatHitsAsContext(hits: RagHit[], label: string): string {
  if (hits.length === 0) {
    return "";
  }
  const lines = ["## " + label, ""];
  for (const h of hits) {
    const loc = h.path ? "`" + h.path + "` " : "";
    lines.push("### " + loc + "(" + h.source + ", score " + h.score.toFixed(2) + ")", "", h.text, "");
  }
  return lines.join("\n");
}

export function getMaxContextTokens(): number {
  return 6000;
}
