const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lógica duplicada de lib/taskReasoning.ts (más routeModel de modelRouter.ts)
// para testear sin paso de compilación.
const MODEL_CATALOG = {
  "claude-opus-4-8": { model_id: "claude-opus-4-8", provider: "anthropic", tier: "premium" },
  "claude-sonnet-4-6": { model_id: "claude-sonnet-4-6", provider: "anthropic", tier: "balanced" },
  "claude-haiku-4-5-20251001": { model_id: "claude-haiku-4-5-20251001", provider: "anthropic", tier: "economy" },
};
const TASK_ROUTING = {
  architecture:      { model_id: "claude-opus-4-8" },
  security_analysis: { model_id: "claude-opus-4-8" },
  code_generation:   { model_id: "claude-sonnet-4-6" },
  test_generation:   { model_id: "claude-sonnet-4-6" },
  planning:          { model_id: "claude-sonnet-4-6" },
  data_analysis:     { model_id: "claude-sonnet-4-6" },
  debugging:         { model_id: "claude-sonnet-4-6" },
  documentation:     { model_id: "claude-haiku-4-5-20251001" },
};
function routeModel(taskType) {
  const route = TASK_ROUTING[taskType];
  return { ...MODEL_CATALOG[route.model_id], task_type: taskType };
}

function classifyGoal(goal) {
  const g = goal.toLowerCase();
  if (/crea|build|nueva aplicaci|plataforma|sistema/.test(g)) return "build_app";
  if (/agrega|a[ñn]ade|implementa|feature/.test(g)) return "add_feature";
  if (/error|bug|falla|fix|repara/.test(g)) return "fix_bug";
  if (/analiza|revisa|audit|inspect/.test(g)) return "analyze";
  if (/deploy|despliega|publica|release/.test(g)) return "deploy";
  return "analyze";
}

const PLAN_TEMPLATES = {
  build_app: [
    { title: "Análisis de requerimientos", agent: "product-manager", task_type: "planning", depends_on: [], requires_human_approval: true, priority: 1 },
    { title: "Diseño de arquitectura", agent: "enterprise-architect", task_type: "architecture", depends_on: ["t1"], requires_human_approval: true, priority: 2 },
    { title: "Análisis de riesgos", agent: "risk-analyst", task_type: "security_analysis", depends_on: ["t2"], requires_human_approval: false, priority: 3 },
    { title: "Planificación de sprints", agent: "sprint-planner", task_type: "planning", depends_on: ["t2"], requires_human_approval: true, priority: 3 },
    { title: "Generación de código", agent: "saas-builder", task_type: "code_generation", depends_on: ["t4"], requires_human_approval: false, priority: 4 },
    { title: "Generación de tests", agent: "test-factory", task_type: "test_generation", depends_on: ["t5"], requires_human_approval: false, priority: 5 },
    { title: "Revisión de seguridad", agent: "saas-builder", task_type: "security_analysis", depends_on: ["t6"], requires_human_approval: true, priority: 6 },
    { title: "Release y documentación", agent: "release-manager", task_type: "documentation", depends_on: ["t7"], requires_human_approval: true, priority: 7 },
  ],
  fix_bug: [
    { title: "Diagnóstico del error", agent: "maintenance-agent", task_type: "debugging", depends_on: [], requires_human_approval: false, priority: 1 },
    { title: "Fix e implementación", agent: "saas-builder", task_type: "code_generation", depends_on: ["t1"], requires_human_approval: false, priority: 2 },
    { title: "Verificación", agent: "test-factory", task_type: "test_generation", depends_on: ["t2"], requires_human_approval: true, priority: 3 },
  ],
  analyze: [
    { title: "Recolección de datos", agent: "maintenance-agent", task_type: "data_analysis", depends_on: [], requires_human_approval: false, priority: 1 },
    { title: "Análisis y propuestas", agent: "enterprise-architect", task_type: "data_analysis", depends_on: ["t1"], requires_human_approval: false, priority: 2 },
    { title: "Reporte", agent: "enterprise-architect", task_type: "documentation", depends_on: ["t2"], requires_human_approval: false, priority: 3 },
  ],
};

function decomposeGoal(goal) {
  const category = classifyGoal(goal);
  const template = PLAN_TEMPLATES[category];
  const subtasks = template.map((t, i) => {
    const id = `t${i + 1}`;
    const rec = routeModel(t.task_type);
    return { ...t, id, estimated_model: rec.model_id, depends_on: t.depends_on };
  });
  const complexity = Math.min(10, Math.max(1, subtasks.length + (category === "build_app" ? 2 : 0)));
  const agents = [...new Set(subtasks.map(s => s.agent))];
  const priority_order = subtasks.slice().sort((a, b) => a.priority - b.priority).map(s => s.id);
  return { goal, complexity_score: complexity, subtasks, priority_order, estimated_agents: agents };
}

describe('classifyGoal (vía decomposeGoal)', () => {
  it('clasifica "crear una plataforma" como build_app', () => {
    assert.equal(decomposeGoal('crear una nueva plataforma de e-commerce').subtasks.length, 8);
  });
  it('clasifica "arreglar un bug" como fix_bug', () => {
    assert.equal(decomposeGoal('arregla este bug de login').subtasks.length, 3);
  });
  it('clasifica un goal sin keywords como analyze por defecto', () => {
    assert.equal(decomposeGoal('algo ambiguo sin verbo claro').subtasks.length, 3);
    assert.equal(decomposeGoal('algo ambiguo sin verbo claro').subtasks[0].agent, 'maintenance-agent');
  });
});

describe('decomposeGoal', () => {
  it('genera subtareas con ids secuenciales t1, t2, ...', () => {
    const plan = decomposeGoal('fix this bug urgente');
    assert.deepEqual(plan.subtasks.map(s => s.id), ['t1', 't2', 't3']);
  });

  it('asigna un modelo estimado a cada subtarea', () => {
    const plan = decomposeGoal('crear una plataforma nueva');
    for (const s of plan.subtasks) {
      assert.ok(s.estimated_model.length > 0);
    }
  });

  it('build_app tiene complejidad = subtareas + 2, acotada a 10', () => {
    const plan = decomposeGoal('crear una plataforma nueva');
    assert.equal(plan.complexity_score, 10);
  });

  it('fix_bug tiene complejidad = número de subtareas (sin bonus)', () => {
    const plan = decomposeGoal('repara este error crítico');
    assert.equal(plan.complexity_score, 3);
  });

  it('priority_order respeta el orden de prioridad, no el de creación', () => {
    const plan = decomposeGoal('crear una plataforma nueva');
    const priorities = plan.priority_order.map(id => plan.subtasks.find(s => s.id === id).priority);
    for (let i = 1; i < priorities.length; i++) {
      assert.ok(priorities[i] >= priorities[i - 1]);
    }
  });

  it('estimated_agents no tiene duplicados', () => {
    const plan = decomposeGoal('crear una plataforma nueva');
    assert.equal(plan.estimated_agents.length, new Set(plan.estimated_agents).size);
  });
});
