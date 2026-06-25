const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lógica pura (mirror de catalogMerge.ts)
const PLAN_ORDER = ['free', 'pro', 'team', 'business', 'enterprise'];

function canInstallTier(userPlan, itemTier) {
  const userIdx = PLAN_ORDER.indexOf(userPlan);
  const itemIdx = PLAN_ORDER.indexOf(itemTier);
  if (userIdx < 0 || itemIdx < 0) return false;
  return userIdx >= itemIdx;
}

function mergeCatalogs(bundled, remote) {
  if (!remote?.items?.length) return bundled;
  const byId = new Map();
  for (const item of bundled.items) byId.set(item.id, item);
  for (const item of remote.items) byId.set(item.id, item);
  return { version: Math.max(bundled.version, remote.version ?? 1), items: [...byId.values()] };
}

const ROLE_MENTION = /^@(architect|fullstack|devops|qa|gps|founder|cto|saas)\b\s*/i;

function detectRoleFromPrompt(prompt) {
  const match = prompt.match(ROLE_MENTION);
  if (!match) return { role: 'default', cleanPrompt: prompt };
  return { role: match[1].toLowerCase(), cleanPrompt: prompt.slice(match[0].length).trim() };
}

describe('canInstallTier', () => {
  it('free solo instala free', () => {
    assert.equal(canInstallTier('free', 'free'), true);
    assert.equal(canInstallTier('free', 'pro'), false);
  });

  it('business instala hasta business', () => {
    assert.equal(canInstallTier('business', 'pro'), true);
    assert.equal(canInstallTier('business', 'business'), true);
    assert.equal(canInstallTier('business', 'enterprise'), false);
  });
});

describe('mergeCatalogs', () => {
  it('fusiona por id sin duplicar', () => {
    const bundled = { version: 1, items: [{ id: 'a', name: 'A' }] };
    const remote = { version: 2, items: [{ id: 'b', name: 'B' }, { id: 'a', name: 'A remote' }] };
    const merged = mergeCatalogs(bundled, remote);
    assert.equal(merged.items.length, 2);
    assert.equal(merged.items.find((i) => i.id === 'a').name, 'A remote');
  });
});

describe('detectRoleFromPrompt', () => {
  it('detecta @founder', () => {
    const r = detectRoleFromPrompt('@founder idea de SaaS GPS');
    assert.equal(r.role, 'founder');
    assert.equal(r.cleanPrompt, 'idea de SaaS GPS');
  });

  it('default sin mención', () => {
    const r = detectRoleFromPrompt('arregla el bug');
    assert.equal(r.role, 'default');
  });
});
