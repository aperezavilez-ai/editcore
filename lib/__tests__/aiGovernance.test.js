const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lógica duplicada de lib/aiGovernance.ts para testear sin paso de compilación
// (mismo patrón que extensions/editcore-claude/test/*.test.js).
const BASE_RULES = {
  read_files:      { allowed: true,  requires_approval: false, min_autonomy_level: 1, description: "Lectura siempre permitida." },
  write_files:     { allowed: true,  requires_approval: true,  min_autonomy_level: 3, description: "Escritura requiere aprobación humana hasta nivel 4." },
  git_commit:      { allowed: true,  requires_approval: true,  min_autonomy_level: 4, description: "Commits siempre requieren aprobación humana." },
  deploy:          { allowed: true,  requires_approval: true,  min_autonomy_level: 4, description: "Deploy siempre requiere aprobación humana." },
  delete_data:     { allowed: false, requires_approval: true,  min_autonomy_level: 5, description: "Eliminar datos prohibido en autonomía < 5." },
  modify_secrets:  { allowed: false, requires_approval: false, min_autonomy_level: 99, description: "Modificar secrets nunca permitido autónomamente." },
  api_call:        { allowed: true,  requires_approval: false, min_autonomy_level: 2, description: "Llamadas API externas permitidas desde nivel 2." },
  create_agent:    { allowed: true,  requires_approval: true,  min_autonomy_level: 3, description: "Crear agentes requiere aprobación." },
  send_message:    { allowed: true,  requires_approval: false, min_autonomy_level: 1, description: "Enviar mensajes de respuesta siempre permitido." },
  access_billing:  { allowed: false, requires_approval: true,  min_autonomy_level: 5, description: "Acceso a facturación requiere máxima autonomía y aprobación." },
};

function checkGovernance(action, autonomyLevel) {
  const rule = BASE_RULES[action];
  if (!rule) {
    return { allowed: false, requires_human_approval: true, reason: `Acción desconocida '${action}' — denegada por defecto.`, autonomy_level_required: 99 };
  }
  if (!rule.allowed && autonomyLevel < rule.min_autonomy_level) {
    return { allowed: false, requires_human_approval: true, reason: `${rule.description} (nivel actual: ${autonomyLevel}, mínimo: ${rule.min_autonomy_level})`, autonomy_level_required: rule.min_autonomy_level };
  }
  if (rule.allowed && autonomyLevel >= rule.min_autonomy_level && !rule.requires_approval) {
    return { allowed: true, requires_human_approval: false, reason: `Acción '${action}' permitida en nivel ${autonomyLevel}.`, autonomy_level_required: rule.min_autonomy_level };
  }
  if (autonomyLevel === 5 && rule.allowed) {
    return { allowed: true, requires_human_approval: false, reason: `Nivel 5 (Optimización continua): '${action}' ejecutado sin bloqueo.`, autonomy_level_required: rule.min_autonomy_level };
  }
  return { allowed: rule.allowed, requires_human_approval: rule.requires_approval, reason: rule.description, autonomy_level_required: rule.min_autonomy_level };
}

describe('checkGovernance', () => {
  it('permite read_files en cualquier nivel sin aprobación', () => {
    const r = checkGovernance('read_files', 1);
    assert.equal(r.allowed, true);
    assert.equal(r.requires_human_approval, false);
  });

  it('bloquea delete_data por debajo del nivel 5', () => {
    const r = checkGovernance('delete_data', 4);
    assert.equal(r.allowed, false);
    assert.equal(r.requires_human_approval, true);
    assert.equal(r.autonomy_level_required, 5);
  });

  it('nunca permite modify_secrets sin importar el nivel', () => {
    const r = checkGovernance('modify_secrets', 99);
    assert.equal(r.allowed, false);
  });

  it('nivel 5 ejecuta sin bloqueo cualquier acción base-permitida', () => {
    const r = checkGovernance('deploy', 5);
    assert.equal(r.allowed, true);
    assert.equal(r.requires_human_approval, false);
  });

  it('write_files en nivel 3 sigue requiriendo aprobación', () => {
    const r = checkGovernance('write_files', 3);
    assert.equal(r.allowed, true);
    assert.equal(r.requires_human_approval, true);
  });

  it('acción desconocida se deniega por defecto', () => {
    const r = checkGovernance('unknown_action', 5);
    assert.equal(r.allowed, false);
    assert.equal(r.autonomy_level_required, 99);
  });
});
