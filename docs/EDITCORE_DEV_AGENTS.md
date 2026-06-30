# EditCore Development Agents (Prompt 21 — Fase 9)

## Decisión de diseño: no se creó una tabla nueva

EditCore ya tiene un sistema genérico de definición de agentes: `agent_definitions` + `agent_versions` (Prompt 5, expuesto en `api/v1/agents/index.ts` y `api/v1/agents/[id]`). Crear una tabla paralela específica para "agentes de desarrollo" duplicaría ese sistema — prohibido explícitamente por las reglas del Prompt 21 ("NO crear funciones duplicadas").

En su lugar, los 7 agentes pedidos se modelan como **registros reales** en `agent_definitions`, igual que cualquier otro agente del Marketplace, con `slug` reservado y `config` describiendo su rol.

## Los 7 agentes (definición, para registrar vía `POST /api/v1/agents`)

| Slug | Nombre | Rol | Modelo recomendado (vía `lib/modelRouter.ts`) |
|---|---|---|---|
| `architect-agent` | Architect Agent | Diseña arquitectura antes de construir, usa `architect/patterns.ts` y `architect/projects.ts` | `claude-opus-4-8` (task_type: `architecture`) |
| `code-builder-agent` | Code Builder Agent | Genera código a partir de un plan ya aprobado | `claude-sonnet-4-6` (task_type: `code_generation`) |
| `code-review-agent` | Code Review Agent | Revisa diffs antes de commit, alineado con `lib/aiGovernance.ts` (`git_commit` requiere aprobación) | `claude-sonnet-4-6` (task_type: `code_review`) |
| `security-agent` | Security Agent | Analiza superficie de ataque, RLS, manejo de secretos | `claude-opus-4-8` (task_type: `security_analysis`) |
| `testing-agent` | Testing Agent | Genera y mantiene la suite de tests (ver `EDITCORE_MASTER_ROADMAP.md` P1.1) | `claude-sonnet-4-6` (task_type: `test_generation`) |
| `documentation-agent` | Documentation Agent | Mantiene los `docs/EDITCORE_*.md` honestos y actualizados | `claude-haiku-4-5-20251001` (task_type: `documentation`) |
| `devops-agent` | DevOps Agent | CI, despliegues, crons (`vercel.json`) | `claude-sonnet-4-6` (task_type: `planning`) |

## Cómo coordinan (real, no aspiracional)

La coordinación real disponible hoy es la del Orquestador Universal (`POST /api/v1/aios/orchestrate`, Prompt 16/20): un `goal` se descompone en subtareas, y cada subtarea trae un `agent` sugerido (el campo `agent_sequence` del run). Si los 7 agentes de arriba están registrados con esos slugs, `decomposeGoal()` puede referenciarlos por nombre en sus subtareas.

**No existe** ejecución automática donde estos agentes realmente corran código de forma autónoma uno tras otro — como se documenta en `EDITCORE_AI_ECOSYSTEM.md`, el orquestador planifica pero no ejecuta. "Coordinados" hoy significa: comparten el mismo plan y la misma gobernanza (`lib/aiGovernance.ts`), no que se invoquen entre sí en tiempo real.

## Cómo registrarlos (acción manual del usuario, no automatizada en este prompt)

No se insertaron estos 7 registros automáticamente porque `POST /api/v1/agents` requiere una sesión de usuario autenticado real (Bearer token), que no existe en esta sesión de trabajo (sin navegador/credenciales activas). El usuario puede crearlos desde `community.html` o vía API una vez autenticado, usando los `slug`/`config` de la tabla de arriba.
