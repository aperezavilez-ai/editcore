# EditCore AI Operations

Estado: **Command Center en producción** en `web/command-center.html`.
Métricas reales de 24h. Lo que no existe aún está documentado abajo.

## 1. AI Command Center

Dashboard de operaciones en `/command-center.html`:

| Panel | Qué muestra |
|---|---|
| Métricas superiores | Runs 24h, completados, fallos, agentes activos, costo, meta-learning |
| Orquestador | Formulario para crear runs con previsualización de plan |
| Gobernanza | Niveles de autonomía y verificador de permisos interactivo |
| Runs recientes | Historial de orquestaciones con status y nivel de autonomía |
| Router de modelos | Consulta interactiva del modelo recomendado para una tarea |

## 2. Self-Healing System (estado real)

El sistema de autocorrección **no existe como proceso autónomo**.
Lo que existe:

- `maintenance-agent` (rol en el IDE): analiza logs que el humano muestra
  y propone fixes como proposals en `evolution_proposals`.
- `api/evolution/proposals.ts`: registra propuestas de mejora.
- `web/evolution.html`: muestra propuestas y métricas de evolución.

Para que el self-healing sea real se necesitaría:
1. Acceso a logs de Vercel en tiempo real (requiere API de Vercel Pro).
2. Un runner que ejecute los fixes propuestos (requiere GitHub App).
3. Tests automáticos que validen el fix antes de mergear.

## 3. Meta Learning System (estado real)

La tabla `ai_meta_learning` existe con campos `event_type`, `context`,
`outcome`, `lesson`, `applies_to` y `confidence`.

Lo que NO existe aún:
- Proceso automático que analice `ai_orchestration_runs` completados y
  extraiga lecciones.
- Mecanismo para que las lecciones modifiquen las plantillas de planificación
  en `lib/taskReasoning.ts`.

Registrar manualmente una lección:
```sql
insert into ai_meta_learning (event_type, context, outcome, lesson, applies_to, confidence)
values ('success', '{"task":"architecture","model":"claude-opus-4-8"}',
        'Arquitectura entregada en 1 sesión',
        'Para proyectos SaaS < 5 tablas, arquitectura en 1 sesión es suficiente',
        'enterprise-architect', 85);
```

## 4. Strategic Planner (estado real)

El planificador estratégico es el rol `@enterprise-architect` en el IDE +
`api/v1/architect/projects.ts`. Genera roadmaps, cost estimates y risk
reports que se almacenan en `architecture_projects`.

No existe un proceso autónomo que genere roadmaps sin intervención humana.

## 5. Métricas en tiempo real

```
GET /api/v1/aios/metrics
Authorization: Bearer <token>
```

Respuesta incluye:
- `orchestration`: total, planning, running, completed, failed (24h)
- `agents`: active, idle, list
- `models`: by_model (calls, cost_usd_cents, errors), total_cost_usd_cents
- `meta_learning`: success, failure, correction, insight (24h)
- `open_proposals`: propuestas de evolución abiertas
- `active_factory_projects`: proyectos en progreso

## 6. Endpoints del AI OS

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/v1/aios/orchestrate` | POST | Crear run de orquestación con plan |
| `/api/v1/aios/runs` | GET/PATCH | Listar y actualizar runs |
| `/api/v1/aios/task-plan` | POST | Previsualizar plan sin crear run |
| `/api/v1/aios/model-router` | POST | Recomendar modelo para una tarea |
| `/api/v1/aios/governance` | GET/POST | Reglas y verificación de permisos |
| `/api/v1/aios/metrics` | GET | Métricas del Command Center |
