const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const ROLE_PERMISSIONS = {
  owner: ['view_projects', 'edit_code', 'run_agents', 'manage_apis', 'manage_users', 'manage_marketplace', 'view_analytics'],
  admin: ['view_projects', 'edit_code', 'run_agents', 'manage_apis', 'manage_users', 'manage_marketplace', 'view_analytics'],
  developer: ['view_projects', 'edit_code', 'run_agents', 'manage_apis'],
  reviewer: ['view_projects', 'run_agents'],
  client: ['view_projects'],
  readonly: ['view_projects'],
};

function roleHasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

function parseCustomMention(prompt) {
  const match = prompt.match(/^@custom:([a-z0-9_-]+)\b\s*/i);
  if (!match?.[1]) return undefined;
  return { agentId: match[1], cleanPrompt: prompt.slice(match[0].length).trim() };
}

const PLAN_LIMITS = {
  free: { maxAgents: 3, maxTeamMembers: 1, marketplacePremium: false },
  pro: { maxAgents: 10, maxTeamMembers: 5, marketplacePremium: true },
  team: { maxAgents: 25, maxTeamMembers: 15, marketplacePremium: true },
  business: { maxAgents: 50, maxTeamMembers: 50, marketplacePremium: true },
  enterprise: { maxAgents: 999, maxTeamMembers: 999, marketplacePremium: true },
};

describe('teamRoles', () => {
  it('owner puede gestionar usuarios', () => {
    assert.equal(roleHasPermission('owner', 'manage_users'), true);
  });

  it('readonly no puede editar código', () => {
    assert.equal(roleHasPermission('readonly', 'edit_code'), false);
  });

  it('developer puede ejecutar agentes', () => {
    assert.equal(roleHasPermission('developer', 'run_agents'), true);
  });
});

describe('parseCustomMention', () => {
  it('detecta @custom:agent-id', () => {
    const r = parseCustomMention('@custom:my-agent haz refactor');
    assert.equal(r.agentId, 'my-agent');
    assert.equal(r.cleanPrompt, 'haz refactor');
  });

  it('undefined sin mención custom', () => {
    assert.equal(parseCustomMention('@architect diseño'), undefined);
  });
});

describe('commercialPlans', () => {
  it('enterprise tiene límites altos', () => {
    assert.equal(PLAN_LIMITS.enterprise.maxAgents, 999);
    assert.equal(PLAN_LIMITS.enterprise.marketplacePremium, true);
  });

  it('free no incluye marketplace premium', () => {
    assert.equal(PLAN_LIMITS.free.marketplacePremium, false);
  });
});
