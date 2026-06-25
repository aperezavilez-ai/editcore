export function tokenizeForRag(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9_]{3,}/g);
  if (!matches) return [];
  return matches;
}

export function buildTermVector(tokens: string[]): Map<string, number> {
  const vec = new Map<string, number>();
  for (const t of tokens) {
    vec.set(t, (vec.get(t) ?? 0) + 1);
  }
  return vec;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, v] of a) normA += v * v;
  for (const [, v] of b) normB += v * v;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const [k, v] of smaller) {
    const w = larger.get(k);
    if (w) dot += v * w;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function chunkText(content: string, maxLen = 600): Array<{ startLine: number; text: string }> {
  const lines = content.split('\n');
  const chunks: Array<{ startLine: number; text: string }> = [];
  let buf: string[] = [];
  let startLine = 1;

  const flush = (endLine: number) => {
    const text = buf.join('\n').trim();
    if (text.length > 0) {
      chunks.push({ startLine, text: text.slice(0, maxLen) });
    }
    buf = [];
    startLine = endLine + 1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (buf.length === 0) startLine = lineNo;

    if (line.trim() === '' && buf.length > 0) {
      flush(lineNo);
      continue;
    }

    buf.push(line);
    const joined = buf.join('\n');
    if (joined.length >= maxLen) {
      flush(lineNo);
    }
  }

  if (buf.length > 0) flush(lines.length);
  return chunks;
}

export function serializeVector(vec: Map<string, number>): Record<string, number> {
  const entries = [...vec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 120);
  const out: Record<string, number> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}

export function deserializeVector(obj: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(obj));
}
