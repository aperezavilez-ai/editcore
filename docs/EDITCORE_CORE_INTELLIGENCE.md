# EditCore Core Intelligence

> **Esto describe el backend web/Vercel** (`lib/`, APIs `/api/v1/aios/*`,
> tablas Supabase). Para el motor de inteligencia *local* dentro de la
> extensión del IDE (sin backend, corre en la máquina del usuario), ver
> `EDITCORE_INTELLIGENCE_CORE.md` — son sistemas distintos a pesar del
> nombre parecido. Para el mapa completo y consolidado de esta capa backend,
> ver `EDITCORE_GLOBAL_AI_ARCHITECTURE.md` (Capa 2); este documento se
> conserva como detalle adicional. (Nota agregada 2026-06-30.)

Estado: **módulos centrales reales**. El cerebro de la plataforma está
implementado como una capa de bibliotecas TypeScript más APIs serverless
en Vercel. El nivel de autonomía máximo hoy es nivel 2 (análisis + lectura)
sin intervención humana; nivel 3-4 requiere aprobación explícita.

## 1. Responsabilidades del Core

| Responsabilidad | Cómo se implementa hoy |
|---|---|
| Coordinar agentes | `decomposeGoal()` asigna agente por subtarea |
| Administrar tareas | `ai_task_plans` + `factory_tasks` |
| Gestionar modelos IA | `lib/modelRouter.ts` — selección por tipo y complejidad |
| Mantener contexto global | `ai_orchestration_runs` — historial por run |
| Tomar decisiones operativas | `lib/aiGovernance.ts` — reglas por nivel |
| Supervisar procesos | `api/v1/aios/metrics.ts` — métricas 24h |

## 2. Módulos que forman el Core

### lib/modelRouter.ts
Selecciona el modelo óptimo para cada tipo de tarea:
- `routeModel(taskType)` → recomendación directa
- `routeByComplexity(taskType, score)` → ajuste por complejidad 1-10
- `estimateCost(modelId, inputTokens, outputTokens)` → costo estimado

### lib/taskReasoning.ts
Descompone objetivos en subtareas accionables:
- `decomposeGoal(goal)` → `TaskPlan` con subtareas, agentes y estrategia
- Clasificación automática: `build_app`, `add_feature`, `fix_bug`, `analyze`, `deploy`, `audit`
- Cada subtarea incluye: agente asignado, modelo recomendado, dependencias, nivel de aprobación

### lib/aiGovernance.ts
Valida permisos de cada acción por nivel de autonomía:
- `checkGovernance(action, autonomyLevel)` → `GovernanceResult`
- `AUTONOMY_LEVELS` — definición de los 5 niveles
- Reglas inmutables: `modify_secrets` nunca permitido autónomamente

## 3. Base de datos del Core Intelligence

| Tabla | Propósito |
|---|---|
| `ai_orchestration_runs` | Cada ejecución del orquestador |
| `ai_task_plans` | Plan de subtareas por run |
| `ai_model_usage` | Log de uso de modelos con costo |
| `ai_agent_activations` | Estado de cada agente por usuario |
| `ai_governance_rules` | Reglas de gobernanza (editables) |
| `ai_meta_learning` | Lecciones aprendidas de resultados |
| `ai_knowledge_snapshots` | Snapshots del estado global de la plataforma |

## 4. Niveles de autonomía

| Nivel | Nombre | Puede hacer |
|---|---|---|
| 1 | Asistente | Solo responder preguntas y mostrar planes |
| 2 | Analista | Leer datos, analizar, llamar APIs de lectura |
| 3 | Ejecutor supervisado | Escribir archivos, crear agentes (con aprobación) |
| 4 | Operador autónomo | Commits, deploys (siempre con aprobación humana) |
| 5 | Optimización continua | Máxima autonomía; acciones críticas se registran |
