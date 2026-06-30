/**
 * Task Reasoning Engine — descompone objetivos complejos en subtareas
 * ordenadas, asigna agentes y estima complejidad.
 *
 * No ejecuta las tareas; produce el plan para que el orquestador lo siga.
 */

import { routeModel, type TaskType } from "./modelRouter";

export interface Subtask {
  id: string;
  title: string;
  description: string;
  agent: string;
  task_type: TaskType;
  estimated_model: string;
  depends_on: string[];
  requires_human_approval: boolean;
  priority: number;
}

export interface TaskPlan {
  goal: string;
  strategy: string;
  complexity_score: number;
  subtasks: Subtask[];
  priority_order: string[];
  estimated_agents: string[];
}

type GoalCategory =
  | "build_app"
  | "add_feature"
  | "fix_bug"
  | "analyze"
  | "deploy"
  | "audit";

function classifyGoal(goal: string): GoalCategory {
  const g = goal.toLowerCase();
  if (/crea|build|nueva aplicaci|plataforma|sistema/.test(g)) return "build_app";
  if (/agrega|a[ñn]ade|implementa|feature/.test(g)) return "add_feature";
  if (/error|bug|falla|fix|repara/.test(g)) return "fix_bug";
  if (/analiza|revisa|audit|inspect/.test(g)) return "analyze";
  if (/deploy|despliega|publica|release/.test(g)) return "deploy";
  return "analyze";
}

const PLAN_TEMPLATES: Record<GoalCategory, Omit<Subtask, "id">[]> = {
  build_app: [
    { title: "Análisis de requerimientos",  description: "Definir PRD, historias de usuario y criterios de aceptación.", agent: "product-manager",     task_type: "planning",         estimated_model: "", depends_on: [],         requires_human_approval: true,  priority: 1 },
    { title: "Diseño de arquitectura",       description: "Stack tecnológico, capas, trade-offs y roadmap.",           agent: "enterprise-architect", task_type: "architecture",     estimated_model: "", depends_on: ["t1"],     requires_human_approval: true,  priority: 2 },
    { title: "Análisis de riesgos",          description: "Riesgos técnicos, financieros y de seguridad.",             agent: "risk-analyst",         task_type: "security_analysis",estimated_model: "", depends_on: ["t2"],     requires_human_approval: false, priority: 3 },
    { title: "Planificación de sprints",     description: "Dividir en sprints con tareas, agentes y dependencias.",    agent: "sprint-planner",       task_type: "planning",         estimated_model: "", depends_on: ["t2"],     requires_human_approval: true,  priority: 3 },
    { title: "Generación de código",         description: "Implementar auth, APIs, UI y base de datos.",               agent: "saas-builder",         task_type: "code_generation",  estimated_model: "", depends_on: ["t4"],     requires_human_approval: false, priority: 4 },
    { title: "Generación de tests",          description: "Unit, integration, e2e y security tests.",                  agent: "test-factory",         task_type: "test_generation",  estimated_model: "", depends_on: ["t5"],     requires_human_approval: false, priority: 5 },
    { title: "Revisión de seguridad",        description: "Auditoría de seguridad sobre el código generado.",          agent: "saas-builder",         task_type: "security_analysis",estimated_model: "", depends_on: ["t6"],     requires_human_approval: true,  priority: 6 },
    { title: "Release y documentación",      description: "Checklist pre-release, notas de versión y registro.",       agent: "release-manager",      task_type: "documentation",    estimated_model: "", depends_on: ["t7"],     requires_human_approval: true,  priority: 7 },
  ],
  add_feature: [
    { title: "Análisis del cambio",          description: "Entender el alcance e impacto en código existente.",         agent: "enterprise-architect", task_type: "architecture",     estimated_model: "", depends_on: [],         requires_human_approval: false, priority: 1 },
    { title: "Implementación",               description: "Código de la nueva funcionalidad.",                          agent: "saas-builder",         task_type: "code_generation",  estimated_model: "", depends_on: ["t1"],     requires_human_approval: false, priority: 2 },
    { title: "Tests",                        description: "Tests para la nueva funcionalidad.",                         agent: "test-factory",         task_type: "test_generation",  estimated_model: "", depends_on: ["t2"],     requires_human_approval: false, priority: 3 },
    { title: "Release",                      description: "Versión, notas y registro.",                                 agent: "release-manager",      task_type: "documentation",    estimated_model: "", depends_on: ["t3"],     requires_human_approval: true,  priority: 4 },
  ],
  fix_bug: [
    { title: "Diagnóstico del error",        description: "Identificar causa raíz en logs y código.",                  agent: "maintenance-agent",    task_type: "debugging",        estimated_model: "", depends_on: [],         requires_human_approval: false, priority: 1 },
    { title: "Fix e implementación",         description: "Corrección del bug con prueba de regresión.",               agent: "saas-builder",         task_type: "code_generation",  estimated_model: "", depends_on: ["t1"],     requires_human_approval: false, priority: 2 },
    { title: "Verificación",                 description: "Confirmar que el fix no rompe nada existente.",             agent: "test-factory",         task_type: "test_generation",  estimated_model: "", depends_on: ["t2"],     requires_human_approval: true,  priority: 3 },
  ],
  analyze: [
    { title: "Recolección de datos",         description: "Obtener logs, métricas y contexto relevante.",              agent: "maintenance-agent",    task_type: "data_analysis",    estimated_model: "", depends_on: [],         requires_human_approval: false, priority: 1 },
    { title: "Análisis y propuestas",        description: "Identificar patrones y proponer mejoras.",                  agent: "enterprise-architect", task_type: "data_analysis",    estimated_model: "", depends_on: ["t1"],     requires_human_approval: false, priority: 2 },
    { title: "Reporte",                      description: "Documento de hallazgos y recomendaciones.",                 agent: "enterprise-architect", task_type: "documentation",    estimated_model: "", depends_on: ["t2"],     requires_human_approval: false, priority: 3 },
  ],
  deploy: [
    { title: "Checklist pre-deploy",         description: "Validar tests, seguridad y versión.",                       agent: "release-manager",      task_type: "planning",         estimated_model: "", depends_on: [],         requires_human_approval: true,  priority: 1 },
    { title: "Release notes",                description: "Documentar cambios de esta versión.",                       agent: "release-manager",      task_type: "documentation",    estimated_model: "", depends_on: ["t1"],     requires_human_approval: false, priority: 2 },
    { title: "Registro de release",          description: "Registrar en factory_releases y actualizar versión.",       agent: "release-manager",      task_type: "documentation",    estimated_model: "", depends_on: ["t2"],     requires_human_approval: true,  priority: 3 },
  ],
  audit: [
    { title: "Auditoría de seguridad",       description: "Revisar vulnerabilidades, dependencias y permisos.",        agent: "maintenance-agent",    task_type: "security_analysis",estimated_model: "", depends_on: [],         requires_human_approval: false, priority: 1 },
    { title: "Auditoría de rendimiento",     description: "Queries lentas, memory leaks, endpoints lentos.",           agent: "maintenance-agent",    task_type: "data_analysis",    estimated_model: "", depends_on: [],         requires_human_approval: false, priority: 1 },
    { title: "Propuesta de mejoras",         description: "Plan de acción priorizado.",                                agent: "enterprise-architect", task_type: "planning",         estimated_model: "", depends_on: ["t1","t2"],requires_human_approval: true,  priority: 2 },
  ],
};

export function decomposeGoal(goal: string): TaskPlan {
  const category = classifyGoal(goal);
  const template = PLAN_TEMPLATES[category];

  const subtasks: Subtask[] = template.map((t, i) => {
    const id = `t${i + 1}`;
    const rec = routeModel(t.task_type);
    const depends_on = t.depends_on.length ? t.depends_on : [];
    return { ...t, id, estimated_model: rec.model_id, depends_on };
  });

  const complexity = Math.min(10, Math.max(1, subtasks.length + (category === "build_app" ? 2 : 0)));
  const agents = [...new Set(subtasks.map(s => s.agent))];

  const strategyMap: Record<GoalCategory, string> = {
    build_app:   "Pipeline completo: requerimientos → arquitectura → riesgos → sprints → código → tests → seguridad → release.",
    add_feature: "Análisis de impacto → implementación incremental → tests → release.",
    fix_bug:     "Diagnóstico de causa raíz → fix mínimo → verificación de regresión.",
    analyze:     "Recolección de evidencia → análisis → reporte accionable.",
    deploy:      "Checklist pre-deploy → documentación → registro oficial.",
    audit:       "Auditoría paralela (seguridad + rendimiento) → plan de acción.",
  };

  const priority_order = subtasks
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(s => s.id);

  return {
    goal,
    strategy: strategyMap[category],
    complexity_score: complexity,
    subtasks,
    priority_order,
    estimated_agents: agents,
  };
}
