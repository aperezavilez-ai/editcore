const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function tokenizeForRag(text) {
  const matches = text.toLowerCase().match(/[a-z0-9_]{3,}/g);
  return matches ?? [];
}

function buildTermVector(tokens) {
  const vec = new Map();
  for (const t of tokens) vec.set(t, (vec.get(t) ?? 0) + 1);
  return vec;
}

function cosineSimilarity(a, b) {
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

function chunkText(content, maxLen = 600) {
  const lines = content.split('\n');
  const chunks = [];
  let buf = [];
  let startLine = 1;
  const flush = (endLine) => {
    const text = buf.join('\n').trim();
    if (text.length > 0) chunks.push({ startLine, text: text.slice(0, maxLen) });
    buf = [];
    startLine = endLine + 1;
  };
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (buf.length === 0) startLine = lineNo;
    if (lines[i].trim() === '' && buf.length > 0) {
      flush(lineNo);
      continue;
    }
    buf.push(lines[i]);
    if (buf.join('\n').length >= maxLen) flush(lineNo);
  }
  if (buf.length > 0) flush(lines.length);
  return chunks;
}

describe('cosineSimilarity', () => {
  it('textos similares puntúan alto', () => {
    const a = buildTermVector(tokenizeForRag('user authentication jwt token login'));
    const b = buildTermVector(tokenizeForRag('jwt token for user login session'));
    const c = buildTermVector(tokenizeForRag('database migration postgres'));
    assert.ok(cosineSimilarity(a, b) > cosineSimilarity(a, c));
  });
});

describe('chunkText', () => {
  it('divide por párrafos', () => {
    const chunks = chunkText('line1\nline2\n\nline3\nline4');
    assert.ok(chunks.length >= 2);
  });
});
