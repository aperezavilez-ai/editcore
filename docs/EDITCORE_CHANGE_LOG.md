# EditCore Change Log (Prompt 21 — Fase 7)

Registro de cambios reales, derivado del historial real de `git log` (no reconstruido de memoria). Se mantiene hacia adelante a partir de este prompt; el historial anterior se resume desde commits reales como contexto.

## Resumen histórico (de `git log`, commits reales)

| Commit | Prompt / cambio |
|---|---|
| `c51e5f4`...`1de7fbf` | Login web (correo+contraseña), robustez del IDE, vínculo usuario↔organización |
| `c09fa5b` | API pública v1, developer keys, SDK TypeScript, portal de desarrolladores (Prompt 11) |
| `6781544` | Self Evolution: auditorías programadas, propuestas con aprobación (Prompt 12) |
| `d8af8c1` | Enterprise Architect IA, biblioteca de arquitecturas (Prompt 13) |
| `b70f7bd` | Software Factory: pipeline de proyectos/tareas/releases (Prompt 14) |
| `47ed656`, `76bfd43` | AI Operating System: núcleo de inteligencia central (Prompt 15) + fix de columna reservada en Postgres |
| `ddda040` | Agent Network: red global autónoma de inteligencia (Prompt 16) |
| `16ef9f9` | Enterprise Operating Model: OKRs, finanzas, org chart (Prompt 17) |
| `641f3a9` | Innovation Lab: ideas, experimentos, startups (Prompt 18) |
| `7de3a9e`, `3175f5f` | Browser Agent: Playwright, búsqueda y navegación web real |
| `939095b` | Digital Enterprise: CEO Intelligence, ventas, marketing, soporte, governance (Prompt 19) |
| `1a68a2f` | Master architecture audit + Global Command Center (Prompt 20) |

## Entradas de este prompt (Prompt 21)

### 2026-06-30 — Prompt 21: Implementation Command (auditoría, roadmap, sin código de producto nuevo)

- **Tipo de cambio**: documentación + análisis. Sin nuevas tablas, sin nuevos endpoints de producto.
- **Archivos creados**:
  - `docs/EDITCORE_CURRENT_STATE_REPORT.md`
  - `docs/EDITCORE_REAL_ARCHITECTURE_MAP.md`
  - `docs/EDITCORE_GAP_ANALYSIS.md`
  - `docs/EDITCORE_MASTER_ROADMAP.md`
  - `docs/EDITCORE_AI_MODEL_STRATEGY.md`
  - `docs/EDITCORE_DEV_AGENTS.md`
  - `docs/EDITCORE_PROJECT_MEMORY.md`
  - `docs/EDITCORE_SPRINT_SYSTEM.md`
  - `docs/EDITCORE_CHANGE_LOG.md` (este archivo)
- **Revisión de código**: lectura directa de `package.json`, `.gitignore`, `vercel.json`, `.github/workflows/editcore-ci.yml`, estructura completa de `api/`, `lib/`, `docs/`.
- **Pruebas**: `npx tsc --noEmit` sobre todo el proyecto → sin errores (confirmado, no se modificó código de producto en este prompt).
- **Seguridad**: confirmado que ningún `.env` real está versionado (`git ls-files | grep env` solo devuelve `.env.example` sin valores).
- **Hallazgos**: CI existente no cubre `api/`/`lib/` (solo extensiones del IDE); 2+ pares de docs con nombres solapados; catálogo de modelos solo incluye Anthropic pese a que el prompt pedía también OpenAI (documentado como brecha real, no fabricado).
- **Próximos pasos**: ejecutar `EDITCORE_MASTER_ROADMAP.md` Prioridad 1 (P1.1 — tests de `lib/`, P1.2 — CI extendido) en un prompt/sprint futuro, siguiendo `EDITCORE_SPRINT_SYSTEM.md`.

### 2026-06-30 — Flujo real de registro → plan gratuito → descarga

- **Tipo de cambio**: código de producto + 1 migración SQL aditiva.
- **Motivo**: la landing (`web/index.html`) ofrecía descarga directa sin registro; se pidió pasar a registro → plan → descarga, con un solo plan real por ahora ("Community", gratis).
- **Archivos modificados**:
  - `web/index.html`: el CTA principal cambia de "Descargar EditCore" a "Registrarse" (enlaza a `/login.html`); se quitó el script que reescribía ese botón con la URL del último release.
  - `web/account.html`: muestra el plan real de la organización (`free` → "Community (gratis)", etc.) y agrega el botón real de descarga + versión dinámica (lógica movida desde `index.html`).
  - `supabase/migrations/0014_auto_org_on_signup.sql` (nueva): trigger `on_auth_user_created` sobre `auth.users` que crea automáticamente una `organization` en plan `free` y un `profile` como `owner` al registrarse — reemplaza el proceso manual que existía en `0003_link_user_to_org.sql` (correr SQL a mano por cada usuario), que no escalaba.
- **Pruebas**: `npx tsc --noEmit` → sin errores.
- **Lo que NO se hizo (gap real, documentado)**: el pop-up de inicio de sesión dentro del IDE de escritorio al abrir la app no se implementó — el código fuente del shell de escritorio (fork de Code-OSS) no está en este repositorio, que solo contiene `extensions/editcore-claude` y `extensions/editcore-connect` más el backend web. Implementarlo requiere trabajar en el repo del IDE de escritorio, fuera del alcance de este cambio.
- **Próximo paso real**: cuando exista acceso al repo del shell de escritorio, agregar ahí una pantalla de login obligatoria al primer arranque que valide contra el mismo Supabase Auth (`EDITCORE_SUPABASE_URL`/`EDITCORE_SUPABASE_ANON_KEY`) ya usado en `web/login.html`.

## Cómo se actualiza este archivo a futuro

Cada sprint ejecutado desde `EDITCORE_MASTER_ROADMAP.md` agrega una entrada nueva siguiendo el mismo formato (fecha, tipo, archivos, pruebas, hallazgos, próximos pasos), inmediatamente después de la última entrada — no se reescriben entradas anteriores.
