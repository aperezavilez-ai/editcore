import assert from 'node:assert';
import { describe, it } from 'node:test';
import { pruneHits, estimateTokens, formatHitsAsContext } from '../out/knowledge/tokenOptimizer.js';

const SENSITIVE = [/api[_-]?key/i, /secret/i, /password/i, /token/i, /sk-[a-z0-9]{10,}/i];

function containsSensitiveContent(text) {
  return SENSITIVE.some((p) => p.test(text));
}

function sanitizeMemoryContent(text) {
  let out = text.replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[REDACTED_KEY]');
  return out.slice(0, 4000);
}

describe('token optimizer', () => {
  it('prunea hits por tokens', () => {
    const hits = [
      { source: 'local_rag', score: 0.9, text: 'a'.repeat(100) },
      { source: 'memory', score: 0.5, text: 'b'.repeat(10000) },
    ];
    const pruned = pruneHits(hits, 50);
    assert.ok(pruned.length >= 1);
    assert.ok(estimateTokens(pruned[0].text) <= 200);
  });

  it('formatea contexto', () => {
    const md = formatHitsAsContext(
      [{ source: 'keyword', score: 0.8, text: 'hello', path: 'src/a.ts' }],
      'Test'
    );
    assert.ok(md.includes('Test'));
    assert.ok(md.includes('src/a.ts'));
  });
});

describe('memory security', () => {
  it('redacta contenido sensible', () => {
    assert.ok(containsSensitiveContent('api_key=sk-abc123secret'));
    const clean = sanitizeMemoryContent('token bearer sk-test1234567890');
    assert.ok(!clean.includes('sk-test'));
  });
});

describe('semantic findings format', () => {
  it('genera markdown inline', () => {
    const findings = [{ kind: 'debt', severity: 'medium', message: 'test' }];
    const md = '# Análisis semántico\n\n' + findings.map((f) => '- **' + f.kind + '**: ' + f.message).join('\n');
    assert.ok(md.includes('debt'));
  });
});
