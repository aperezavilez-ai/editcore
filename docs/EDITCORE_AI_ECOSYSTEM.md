# EditCore AI Ecosystem (Prompt 20 — Fases 3, 4, 6)

Este documento responde a las Fases 3 (Unified AI Intelligence Layer), 4 (Universal AI Orchestrator) y 6 (AI Model Intelligence Router) del Prompt 20. **No se crearon sistemas nuevos para estas fases**: ya existían desde el Prompt 16 (AI Operating System) y se documentan aquí en su forma real.

## Unificación de inteligencia (Fase 3)

No existe un único "cerebro" en memoria que conecte modelos, agentes, memoria, herramientas y conocimiento como un proceso continuo. Lo que existe realmente es una unificación **a nivel de datos y contrato de API**:

- Todos los agentes se identifican por `agent_slug` consistentemente en `ai_agent_activations`, `agent_teams`, `dco_support_tickets.assigned_agent`, etc.
- El conocimiento generado por cualquier módulo puede registrarse como nodo en `knowledge_nodes` (Prompt 16) vía `POST /api/v1/network/knowledge`, con `source_agent` para rastrear su origen.
- Las herramientas (Browser Agent, Software Factory, etc.) son invocables vía API REST estándar — no hay un protocolo propietario de "tool calling" interno.

**No existe** una sesión de conversación persistente que mantenga contexto entre llamadas a distintos módulos; cada request es independiente.

## Orquestador Universal (Fase 4)

Implementado realmente en `POST /api/v1/aios/orchestrate` (`api/v1/aios/orchestrate.ts`), apoyado en `lib/taskReasoning.ts`:

1. Recibe un `goal` en texto libre.
2. `checkGovernance("api_call", autonomy_level)` valida que el nivel de autonomía permita iniciar la orquestación.
3. `decomposeGoal(goal)` genera una estrategia, una lista de subtareas con agente sugerido por subtarea, y un `complexity_score`.
4. Se persiste el run en `ai_orchestration_runs` y el plan en `ai_task_plans`.

**No existe** ejecución automática de las subtareas generadas — el plan se devuelve y queda registrado, pero no hay un loop que dispare cada agente sugerido secuencialmente. Eso requeriría un worker persistente o un cron, no implementado.

## AI Model Intelligence Router (Fase 6)

Implementado en `lib/modelRouter.ts`, expuesto en `POST /api/v1/aios/model-router`:

- `routeModel(taskType)`: recomienda un modelo según 11 tipos de tarea (`architecture`, `code_generation`, `code_review`, `security_analysis`, `test_generation`, `planning`, `documentation`, `summarization`, `simple_qa`, `data_analysis`, `debugging`).
- `routeByComplexity(taskType, complexityScore)`: ajusta la recomendación según un puntaje de complejidad 0-100.

**No existe** una integración real que mida automáticamente costo/velocidad/calidad de llamadas reales a cada modelo y reajuste el ranking dinámicamente — el router usa reglas fijas predefinidas en código, no aprendizaje continuo. `ai_model_usage` (consultado en `aios/metrics.ts`) registra costo y éxito de llamadas, pero el router no lo retroalimenta automáticamente todavía.

## Resumen honesto

| Pieza pedida | Estado real |
|---|---|
| Unified AI Intelligence Layer | Unificación de datos/contrato, no proceso único en memoria |
| Universal AI Orchestrator | Planifica y registra; no ejecuta el plan automáticamente |
| AI Model Router | Reglas fijas por tipo de tarea/complejidad; sin feedback loop de costo real |
