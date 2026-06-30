# EditCore Current State Report (Prompt 21 — Fase 1)

Análisis directo del repositorio en su estado actual (post Prompt 20), antes de construir nada nuevo.

## Estructura del repositorio

```
api/            → Vercel serverless functions (backend real)
  auth/, community/, developer/, evolution/, org/, usage/   ← rutas legacy (pre /v1)
  v1/agents, v1/aios, v1/architect, v1/browser, v1/dco,
  v1/enterprise, v1/factory, v1/global, v1/lab, v1/network   ← rutas por módulo (Prompts 16-20)
lib/            → 8 módulos compartidos (auth x3, supabaseAdmin, governance, modelRouter, taskReasoning, browserAgent)
web/            → 14 dashboards HTML estáticos + landing
supabase/migrations/  → 13 migraciones SQL secuenciales (0001-0013)
docs/           → 70+ archivos EDITCORE_*.md
orchestrator.ts → script de 32K en la raíz (orquestador local del IDE, no del backend web)
sdk/, extensions/, releases/, scripts/  → relacionados con el fork de Code-OSS / build del IDE de escritorio
```

## Frontend

- **Landing + dashboards**: HTML/CSS/JS plano, sin framework ni bundler. Cada dashboard (`web/*.html`) es autocontenido, usa `localStorage.editcore_token` para sesión y `fetch` directo a `/api/v1/...`.
- **No hay build step** para el frontend web (no React/Vue, no webpack/vite) — esto reduce complejidad de despliegue pero también significa sin componentización ni reutilización de UI entre dashboards (cada uno repite su propio HTML/CSS).
- **IDE de escritorio**: fork de Code-OSS (`extensions/`, `sdk/`, `orchestrator.ts`) — es un proyecto separado del backend web, comparten repositorio pero no código en tiempo de ejecución.

## Backend

- **100% funciones serverless de Vercel**, sin servidor persistente propio.
- **Dos generaciones de rutas conviven**: `api/{auth,community,developer,evolution,org,usage}/*` (anteriores a la convención `/v1`) y `api/v1/<módulo>/*` (desde Prompt 16 en adelante). Ambas están activas y en uso (`vercel.json` referencia crons a `/api/evolution/audit`, que es de la generación legacy). **No es código muerto** — es deuda de nomenclatura, no duplicación funcional.

## Base de datos

- Supabase Postgres, 13 migraciones aplicadas secuencialmente (`0001_init.sql` → `0013_digital_enterprise.sql`).
- RLS habilitado de forma consistente desde la migración 0005.
- Sin ORM — todas las queries usan el cliente `@supabase/supabase-js` directo.

## Autenticación

Tres mecanismos reales y verificados en código:
1. Sesión Supabase Auth (`lib/userAuth.ts`, Bearer JWT).
2. API key de desarrollador (`lib/developerAuth.ts`, prefijo `ec_live_`).
3. API key de organización (`lib/orgAuth.ts`, header `x-editcore-org-key`).

## Variables de entorno

`.env.example` documenta `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Verificado: **ningún valor real está commiteado** — `.env` y `.env.local` están en `.gitignore`, y `git ls-files` confirma que no hay archivos `.env` reales versionados, solo `.env.example` (vacío de valores) y dos `.env.example` dentro de plantillas de `extensions/`.

## Integraciones

- **Stripe**: dependencia instalada (`stripe@^16.12.0`), pero — consistente con docs anteriores — la integración de cobro real (productos, webhooks activos) sigue pendiente de que el usuario configure su cuenta de Stripe.
- **Supabase**: integración completa y en uso real en todos los módulos.
- **Playwright**: integración real (Browser Agent, Prompt extra), sin dependencias de API keys de terceros.
- **Sin integración de modelo de lenguaje generativo** (OpenAI/Claude API) conectado en runtime — el "Model Router" (`lib/modelRouter.ts`) recomienda qué modelo usar, pero no hay ninguna llamada real saliente a una API de LLM en el código actual.

## Dependencias (`package.json`)

```json
"dependencies": { "@supabase/supabase-js", "playwright", "stripe" }
"devDependencies": { "@vercel/node", "typescript" }
```

Mínimas y todas en uso real — no se detectaron dependencias huérfanas en la raíz del proyecto web/backend.

## Código duplicado

- **No se encontró duplicación de lógica de negocio** entre módulos `api/v1/*` (confirmado en la auditoría del Prompt 20, Fase 1).
- **Sí existe duplicación de nombres en `docs/`**: por ejemplo `EDITCORE_CORE_INTELLIGENCE.md` y `EDITCORE_INTELLIGENCE_CORE.md` son archivos distintos con contenido distinto pero títulos casi idénticos, generados en sesiones diferentes. Mismo patrón sospechoso entre `EDITCORE_AI_ARCHITECTURE.md`, `EDITCORE_AI_OS_ARCHITECTURE.md`, `EDITCORE_GLOBAL_AI_ARCHITECTURE.md` y `EDITCORE_ECOSYSTEM_ARCHITECTURE.md` — los 4 describen "arquitectura de IA" desde ángulos distintos pero se solapan. Esto es deuda de documentación, no de código.

## Errores existentes

- `npx tsc --noEmit` sobre todo el proyecto: **sin errores** (verificado en este prompt y en el Prompt 20).
- No se ejecutó suite de pruebas automatizadas para el backend web (`api/`, `lib/`) porque **no existe ninguna** (no hay carpeta `tests/` ni framework de testing configurado en el `package.json` raíz). Esto es una brecha real, no un código roto.
- **CI sí existe** (`.github/workflows/editcore-ci.yml`), pero cubre exclusivamente las extensiones del IDE (`extensions/editcore-claude`, `extensions/editcore-connect`): compila, corre `npm test`/`npm audit` y las pruebas de `rag-utils`. **No corre `tsc --noEmit` ni ninguna prueba sobre `api/` o `lib/`** (el backend web/Vercel) — cada prompt de esta serie ha validado tipos manualmente con `npx tsc --noEmit` en la sesión, no automáticamente en cada push.

## Qué falta / qué está incompleto

- Sin pruebas automatizadas para `api/`/`lib/` (unitarias, integración, e2e).
- CI existe pero no cubre el backend web — no corre `tsc`/lint/tests sobre `api/` o `lib/` en cada push.
- Sin integración real de LLM para las funciones "generativas" descritas en los docs de IA.
- Stripe sin activar (requiere acción del usuario en su dashboard).
- Sin observabilidad (logs estructurados, métricas de error, APM).

## Qué debe eliminarse

**Nada se elimina en este prompt.** Borrar archivos es una acción destructiva que requiere confirmación explícita del usuario; este reporte solo identifica candidatos:
- Posible consolidación (no eliminación) de los docs de arquitectura de IA solapados listados arriba — requeriría revisión humana antes de fusionar/borrar.

## Qué debe mejorarse

1. Migrar las rutas legacy (`api/{auth,community,developer,evolution,org,usage}`) a la convención `/v1` para consistencia — riesgo medio porque `vercel.json` y el frontend ya apuntan a las rutas actuales.
2. Agregar un framework de pruebas mínimo (ver `EDITCORE_MASTER_ROADMAP.md`, Prioridad 1).
3. Consolidar documentación de arquitectura de IA solapada.
