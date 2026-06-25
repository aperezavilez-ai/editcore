const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function summarizeFindings(findings) {
  const summary = { critical: 0, warning: 0, info: 0, ok: 0, total: findings.length };
  for (const f of findings) {
    summary[f.severity]++;
  }
  return summary;
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, ok: 3 };

function sortFindingsBySeverity(findings) {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

describe('summarizeFindings', () => {
  it('cuenta severidades', () => {
    const s = summarizeFindings([
      { severity: 'critical' },
      { severity: 'warning' },
      { severity: 'ok' },
      { severity: 'ok' },
    ]);
    assert.equal(s.critical, 1);
    assert.equal(s.warning, 1);
    assert.equal(s.ok, 2);
    assert.equal(s.total, 4);
  });
});

describe('sortFindingsBySeverity', () => {
  it('ordena critical primero', () => {
    const sorted = sortFindingsBySeverity([
      { id: 'a', severity: 'ok' },
      { id: 'b', severity: 'critical' },
      { id: 'c', severity: 'info' },
    ]);
    assert.equal(sorted[0].id, 'b');
    assert.equal(sorted[1].id, 'c');
    assert.equal(sorted[2].id, 'a');
  });
});
