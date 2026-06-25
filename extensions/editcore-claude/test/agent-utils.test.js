const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lógica pura duplicada para tests sin cargar vscode
function tokenize(text) {
  const matches = text.toLowerCase().match(/[a-z0-9_]{3,}/g);
  if (!matches) return [];
  return [...new Set(matches)].slice(0, 200);
}

function globMatch(pattern, relPath) {
  const norm = relPath.replace(/\\/g, '/');
  const p = pattern.replace(/\\/g, '/');
  if (p.includes('**')) {
    const escaped = p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(norm);
  }
  if (p.includes('*')) {
    const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp(`^${escaped}$`, 'i').test(norm);
  }
  return norm === p || norm.endsWith('/' + p);
}

describe('tokenize', () => {
  it('extrae tokens únicos', () => {
    const t = tokenize('Hello hello World_edit');
    assert.ok(t.includes('hello'));
    assert.ok(t.includes('world_edit'));
  });
});

describe('globMatch', () => {
  it('coincide con **', () => {
    assert.equal(globMatch('**/*.ts', 'src/foo/bar.ts'), true);
    assert.equal(globMatch('**/*.ts', 'readme.md'), false);
  });

  it('coincide patrón simple', () => {
    assert.equal(globMatch('package.json', 'package.json'), true);
  });
});

describe('extractSymbols', () => {
  function extractSymbols(content) {
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
      /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    ];
    const found = new Set();
    for (const re of patterns) {
      let m;
      while ((m = re.exec(content)) !== null) found.add(m[1]);
    }
    return [...found];
  }

  it('extrae funciones y clases', () => {
    const src = 'export async function foo() {}\nclass Bar {}';
    const syms = extractSymbols(src);
    assert.ok(syms.includes('foo'));
    assert.ok(syms.includes('Bar'));
  });
});
