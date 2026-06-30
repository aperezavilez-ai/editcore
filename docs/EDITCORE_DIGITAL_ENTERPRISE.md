# EditCore Digital Enterprise (Prompt 19)

## Qué es

Una capa de "empresa digital autónoma" sobre EditCore: un conjunto de tablas y APIs que modelan operaciones reales de negocio (productos, ventas, marketing, soporte, crecimiento, gobernanza) más un agente de inteligencia ejecutiva que agrega esos datos en snapshots accionables.

## Lo que SÍ existe (real, funcional)

- **Migración**: `supabase/migrations/0013_digital_enterprise.sql` — 9 tablas con RLS (`auth.uid() = user_id` en todas):
  - `dco_products` — portafolio de productos
  - `dco_leads` — pipeline comercial
  - `dco_proposals` — propuestas comerciales ligadas a leads
  - `dco_campaigns` — campañas de marketing
  - `dco_support_tickets` — soporte al cliente
  - `dco_growth_initiatives` — iniciativas de crecimiento
  - `dco_business_units` — unidades de negocio nuevas
  - `dco_governance_decisions` — decisiones que requieren aprobación
  - `dco_executive_snapshots` — reportes ejecutivos generados

- **APIs** (todas con Bearer token de Supabase Auth, en `/api/v1/dco/`):
  - `products.ts` — GET/POST/PATCH, resumen con MRR total
  - `leads.ts` — GET/POST/PATCH, pipeline ponderado por probabilidad
  - `proposals.ts` — GET/POST/PATCH
  - `campaigns.ts` — GET/POST/PATCH
  - `support.ts` — GET/POST/PATCH, auto-asignación de agente por categoría
  - `growth.ts` — GET/POST/PATCH
  - `business-units.ts` — GET/POST/PATCH, genera proyección financiera estimada
  - `governance.ts` — GET/POST/PATCH
  - `executive.ts` — GET (lista snapshots) / POST (agrega datos reales y genera snapshot)
  - `metrics.ts` — GET, métricas agregadas para el Command Center

- **Dashboard**: `web/enterprise-command.html` — Digital Command Center con 7 pestañas (Vista CEO, Productos, Ventas, Marketing, Soporte, Crecimiento, Gobernanza).

## Lo que NO existe aún

- No hay automatización real de ventas/marketing (envío de emails, publicación en redes, etc.) — son registros y seguimiento manual vía dashboard.
- No hay integración de pagos real (Stripe) para cobrar MRR — los valores de `mrr_usd_cents` se ingresan manualmente.
- No hay un modelo de IA generativa conectado a estas tablas para redactar propuestas, copys de campaña o respuestas de soporte automáticamente — el "agente asignado" es solo una etiqueta de categorización (ver `EDITCORE_EXECUTIVE_AI.md`).
- No hay notificaciones push/email cuando se crea una decisión de gobernanza pendiente.

Ver también: `EDITCORE_COMPANY_OPERATING_MODEL.md`, `EDITCORE_EXECUTIVE_AI.md`, `EDITCORE_GROWTH_ENGINE.md`, `EDITCORE_BUSINESS_BUILDER.md`.
