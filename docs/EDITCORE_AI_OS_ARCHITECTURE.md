# EditCore AI Operating System — Arquitectura

Estado: **núcleo real implementado**. Las capas de coordinación, gobernanza
y enrutamiento de modelos existen como código en producción. La ejecución
autónoma de nivel 4-5 (commits, deploys sin humano) está bloqueada por
diseño hasta que exista infraestructura de CI y sandbox de seguridad.

## 1. Visión general

El AI OS de EditCore es la capa de orquestación central que conecta todos
los subsistemas de la plataforma. No reemplaza los módulos existentes —
los integra y coordina.

```
┌─────────────────────────────────────────────────────────────┐
│                   EDITCORE AI OS                            │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Orchestrator│  │ Model Router │  │ Task Reasoning    │  │
│  │            │  │              │  │ Engine            │  │
│  └────────────┘  └──────────────┘  └───────────────────┘  │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Governance │  │ Meta Learning│  │ Knowledge Brain   │  │
│  │ System     │  │ System       │  │ (Global Memory)   │  │
│  └────────────┘  └──────────────┘  └───────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
   Software       Evolution        Agent          Enterprise
   Factory        Engine           System         Architect
```

## 2. Componentes implementados

| Componente | Archivo | Estado |
|---|---|---|
| Orchestrator | `api/v1/aios/orchestrate.ts` | Real |
| Model Router | `lib/modelRouter.ts` | Real |
| Task Reasoning | `lib/taskReasoning.ts` | Real |
| Governance | `lib/aiGovernance.ts` | Real |
| Metrics API | `api/v1/aios/metrics.ts` | Real |
| Command Center | `web/command-center.html` | Real |
| DB: runs, plans, usage | migración 0009 | Real |

## 3. Flujo de una orquestación

```
POST /api/v1/aios/orchestrate { goal, autonomy_level }
  → checkGovernance("api_call", level)       [lib/aiGovernance.ts]
  → decomposeGoal(goal)                      [lib/taskReasoning.ts]
      → classifyGoal()  → PLAN_TEMPLATES
      → subtasks con routeModel() por tarea  [lib/modelRouter.ts]
  → INSERT ai_orchestration_runs
  → INSERT ai_task_plans
  → { run, plan } devuelto al cliente
```

## 4. Lo que NO existe todavía

- **Ejecución real de subtareas**: el plan se crea, pero los agentes no
  ejecutan las subtareas automáticamente. Requiere GitHub App + runner.
- **Persistencia de memoria global entre sesiones**: `ai_knowledge_snapshots`
  existe como tabla pero aún no hay proceso automático que la pobla.
- **Meta-learning activo**: la tabla `ai_meta_learning` existe para registrar
  lecciones, pero no hay aún un proceso que analice runs pasados y
  actualice las reglas de planificación.
- **Integración con Evolution Engine**: el AI OS puede leer proposals pero
  no cierra el loop de aprendizaje automáticamente.
