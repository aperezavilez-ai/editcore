# EditCore Growth Engine (Prompt 19)

## Qué es

Sistema de seguimiento de iniciativas de crecimiento (adquisición, retención, expansión, monetización, entrada a mercado, partnerships).

## Lo que SÍ existe (real)

- Tabla `dco_growth_initiatives` (migración 0013) con: `title`, `initiative_type`, `description`, `target_metric`, `target_value`, `current_value`, `market`, `strategy`, `status`, `estimated_impact`.
- API `api/v1/dco/growth.ts`:
  - `GET /api/v1/dco/growth?status=...` — lista iniciativas del usuario.
  - `POST /api/v1/dco/growth` — crea iniciativa (requiere `title`, `initiative_type`, `description`).
  - `PATCH /api/v1/dco/growth` — actualiza estado/progreso (`current_value`, `status`).
- El Command Center (`web/enterprise-command.html`, pestaña "Crecimiento") permite crear y ver iniciativas.
- El conteo de iniciativas activas alimenta el snapshot ejecutivo (`active_growth_initiatives`) y las métricas del Command Center.

## Lo que NO existe aún

- No hay un motor que sugiera automáticamente nuevas iniciativas de crecimiento basado en datos (eso sería IA generativa, no implementada).
- No hay integración con canales reales de adquisición (ads, SEO tools, etc.) — el campo `market`/`strategy` es texto libre ingresado manualmente.
- No hay cálculo automático de `current_value` desde otras tablas (ej. usuarios activos reales) — se actualiza manualmente vía PATCH.
