# EditCore Master Roadmap (Prompt 21 — Fase 4)

Roadmap derivado directamente de `EDITCORE_GAP_ANALYSIS.md`. Cada tarea es ejecutable sobre el código real existente — ninguna requiere reescribir módulos funcionando.

## Prioridad 1 — Funciones esenciales

### P1.1 — Suite mínima de tests para `lib/` ✅ COMPLETADO (2026-06-30)
- **Objetivo**: proteger la lógica compartida más crítica (`aiGovernance.ts`, `modelRouter.ts`, `taskReasoning.ts`) con pruebas unitarias.
- **Archivos afectados**: nuevo `lib/__tests__/*.test.ts` (o similar), `package.json` (agregar script `test`).
- **Dependencias**: ninguna; estas funciones son puras (sin I/O), ideales para empezar.
- **Complejidad**: baja.
- **Riesgo**: bajo — solo agrega archivos, no modifica lógica existente.
- **Resultado esperado**: `npm test` corre y valida `checkGovernance`, `routeModel`, `routeByComplexity`, `decomposeGoal` con casos reales.

### P1.2 — Extender CI para cubrir backend web ✅ COMPLETADO (2026-06-30)
- **Objetivo**: que cada push valide `api/`/`lib/` automáticamente, no solo las extensiones del IDE.
- **Archivos afectados**: `.github/workflows/editcore-ci.yml` (nuevo job) o un workflow nuevo, ej. `editcore-web-ci.yml`.
- **Dependencias**: P1.1 (para que haya algo que correr además de `tsc`).
- **Complejidad**: baja.
- **Riesgo**: bajo.
- **Resultado esperado**: cada PR ejecuta `npx tsc --noEmit` y `npm test` sobre la raíz del repo.

## Prioridad 2 — Mejoras de arquitectura

### P2.1 — Documentar y congelar la convención de rutas `/v1` ✅ COMPLETADO (2026-06-30)
- **Objetivo**: dejar explícito que toda ruta nueva va en `api/v1/<módulo>/`, y que las rutas legacy (`api/{auth,community,developer,evolution,org,usage}`) se mantienen pero no se expanden.
- **Archivos afectados**: `README.md` o un nuevo `docs/EDITCORE_API_CONVENTIONS.md`.
- **Dependencias**: ninguna.
- **Complejidad**: baja.
- **Riesgo**: ninguno (solo documentación).

### P2.2 — Consolidar documentación de arquitectura de IA solapada ✅ COMPLETADO (2026-06-30)
- **Objetivo**: revisar (no borrar automáticamente) `EDITCORE_CORE_INTELLIGENCE.md` / `EDITCORE_INTELLIGENCE_CORE.md` y el cluster de 4 docs de arquitectura de IA, y fusionar lo que sea redundante.
- **Archivos afectados**: los docs mencionados en `EDITCORE_CURRENT_STATE_REPORT.md`.
- **Dependencias**: ninguna, pero requiere confirmación explícita del usuario antes de borrar cualquier archivo.
- **Complejidad**: baja.
- **Riesgo**: bajo si se pide confirmación antes de eliminar.

## Prioridad 3 — Funciones avanzadas

### P3.1 — Integración real de un modelo de lenguaje ✅ COMPLETADO (2026-06-30, requiere que el usuario configure ANTHROPIC_API_KEY en Vercel)
- **Objetivo**: que `aios/orchestrate.ts` y el Model Router puedan, opcionalmente, invocar un modelo real (Claude API u OpenAI API) usando una clave que el propio usuario configure en Vercel — nunca en el repositorio.
- **Archivos afectados**: nuevo `lib/llmClient.ts`, modificación de `api/v1/aios/orchestrate.ts`.
- **Dependencias**: el usuario debe tener su propia API key de modelo, configurada en variables de entorno de Vercel.
- **Complejidad**: media.
- **Riesgo**: medio — manejar costos y fallos de la API externa requiere límites y manejo de errores cuidadoso.
- **Resultado esperado**: el orquestador puede generar planes con razonamiento real de un LLM en vez de reglas fijas, sin romper el modo actual (reglas fijas) como fallback.

### P3.2 — Ejecución automática de planes de orquestación ✅ COMPLETADO (2026-06-30) — ver `api/v1/aios/execute.ts`
- **Objetivo**: que un run en `ai_orchestration_runs` pueda avanzar de `planning` a `running`/`completed` automáticamente.
- **Archivos afectados**: `api/v1/aios/runs.ts`, posible nuevo endpoint `api/v1/aios/execute.ts`.
- **Dependencias**: P3.1 (sin LLM real, "ejecutar" una subtarea no tiene con qué razonar).
- **Complejidad**: alta.
- **Riesgo**: alto — ejecución autónoma de pasos requiere que el Trust Framework (`aiGovernance.ts`) se aplique estrictamente en cada paso, no solo al inicio.

## Prioridad 4 — Innovación futura

### P4.1 — Observabilidad real ⏳ PARCIAL (2026-06-30) — ver `docs/EDITCORE_OBSERVABILITY.md`
- **Objetivo**: conectar Vercel Analytics o Sentry para medir errores y latencia reales.
- **Hecho**: las 15 páginas de `web/*.html` ya cargan los scripts oficiales de Vercel Web Analytics y Speed Insights (`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`). No requieren ninguna clave — Vercel los activa solos en cuanto el usuario prende el toggle "Analytics" / "Speed Insights" del proyecto en su dashboard.
- **Falta (responsabilidad del usuario)**: activar esos dos toggles en Vercel (Project → Analytics / Speed Insights), y, si se quiere tracking de errores de backend (no solo de páginas), crear una cuenta en Sentry y pasar `SENTRY_DSN` para cargarla en Vercel — nunca en el repo.
- **Archivos afectados**: `web/*.html` (script tags agregados), configuración de proyecto en Vercel (fuera del repo, pendiente).
- **Dependencias**: cuenta del usuario en Vercel (ya existe) y, opcionalmente, en Sentry.
- **Complejidad**: media.
- **Riesgo**: bajo.

### P4.2 — Optimization Engine alimentado por datos reales
- **Objetivo**: que el Evolution Engine (`evolution_proposals`) reciba propuestas automáticas basadas en datos reales de costo/latencia.
- **Dependencias**: P4.1 (sin observabilidad no hay datos que analizar).
- **Complejidad**: alta.
- **Riesgo**: medio.

### P4.3 — Interfaz conversacional unificada
- **Objetivo**: un punto de entrada de chat que use el Orquestador Universal para enrutar a cualquier módulo.
- **Dependencias**: P3.1 y P3.2.
- **Complejidad**: alta.
- **Riesgo**: alto (UX completamente nueva, requiere validación con usuarios reales).

## Regla de ejecución

Ninguna tarea de Prioridad 2+ se inicia sin que la de Prioridad 1 correspondiente esté en verde. No se reescribe ningún módulo funcionando — todas las tareas son aditivas o de consolidación, consistente con la regla "NO reescribir todo desde cero si no es necesario".
