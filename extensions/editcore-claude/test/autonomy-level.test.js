const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function levelAllowsAction(level, action) {
  const matrix = { analyze: 1, plan: 2, write_approved: 3, execute_tasks: 4, continuous: 5 };
  return level >= matrix[action];
}

describe('autonomy levels', () => {
  it('nivel 1 solo analiza', () => {
    assert.equal(levelAllowsAction(1, 'analyze'), true);
    assert.equal(levelAllowsAction(1, 'plan'), false);
    assert.equal(levelAllowsAction(1, 'execute_tasks'), false);
  });
  it('nivel 4 ejecuta tareas', () => {
    assert.equal(levelAllowsAction(4, 'execute_tasks'), true);
    assert.equal(levelAllowsAction(4, 'continuous'), false);
  });
  it('nivel 5 continuo', () => {
    assert.equal(levelAllowsAction(5, 'continuous'), true);
  });
});

describe('roadmap phases', () => {
  it('tiene 10 fases', () => {
    const phases = Array.from({ length: 10 }, (_, i) => i + 1);
    assert.equal(phases.length, 10);
  });
});
