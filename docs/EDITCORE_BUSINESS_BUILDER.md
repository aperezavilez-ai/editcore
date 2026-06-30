# EditCore Business Builder Agent (Prompt 19)

## Qué es

Sistema para registrar y dar seguimiento a nuevas unidades de negocio (ideas de productos/empresas digitales) desde la concepción hasta el lanzamiento.

## Lo que SÍ existe (real)

- Tabla `dco_business_units` (migración 0013): `name`, `concept`, `target_market`, `business_model`, `revenue_model`, `status` (ideation → validation → building → launched → scaling → closed), `products`, `team_agents`, `financial_projection`.
- API `api/v1/dco/business-units.ts`:
  - `GET /api/v1/dco/business-units?status=...` — lista unidades del usuario.
  - `POST /api/v1/dco/business-units` — crea unidad (requiere `name`, `concept`, `target_market`, `business_model`) y genera automáticamente un objeto `financial_projection`:
    ```json
    {
      "year1": { "revenue_low_usd": 6000, "revenue_high_usd": 60000, "costs_usd": 24000 },
      "year2": { "revenue_low_usd": 30000, "revenue_high_usd": 300000, "costs_usd": 60000 },
      "breakeven_estimate_months": 12,
      "assumptions": ["Validación de mercado en 3-6 meses", "MVP funcional en 4-8 semanas", "Modelo de ingresos validado con primeros 10 clientes"]
    }
    ```
  - `PATCH /api/v1/dco/business-units` — actualiza `status`, `products`, `team_agents`, `financial_projection`.
- El conteo de unidades alimenta `dco_executive_snapshots` y `api/v1/dco/metrics.ts`.

## Importante: la proyección financiera es una ESTIMACIÓN genérica, no un cálculo real

Los números de `financial_projection` son una plantilla fija de supuestos (no varían según el `business_model` ni datos de mercado reales). Se generan así para que el usuario tenga un punto de partida, pero **no representan un análisis financiero real** — el array `assumptions` lo deja explícito en el propio dato devuelto por la API.

## Lo que NO existe aún

- No hay validación de mercado automática (encuestas, scraping de competencia) conectada a esta tabla — para eso existe el Innovation Lab del Prompt 18 (`lab_startups`, `lab_competitive_intel`), que es un sistema separado y no está enlazado automáticamente con `dco_business_units`.
- No hay generación real de MVP/código a partir de una unidad de negocio — el campo `products` es JSON manual.
- No hay asignación real de agentes de IA trabajando en la unidad — `team_agents` es solo una lista de etiquetas/nombres, no agentes ejecutándose.
