# EditCore Executive AI — CEO Intelligence Agent (Prompt 19)

## Qué es

Un agente que agrega datos reales de todas las tablas operativas de EditCore y genera un snapshot ejecutivo con KPIs, oportunidades, riesgos y recomendaciones.

## Cómo funciona (real)

`POST /api/v1/dco/executive` consulta en paralelo:

- `dco_products`, `dco_leads`, `dco_support_tickets`, `dco_campaigns`, `dco_growth_initiatives`, `dco_governance_decisions`
- `biz_okrs`, `biz_finance_records` (Prompt 17)
- `factory_projects` (sistema de proyectos existente)

Con esos datos calcula KPIs reales:

```
total_mrr_usd_cents, total_active_users, pipeline_usd_cents,
net_revenue_usd_cents, avg_okr_progress, open_tickets,
active_products, active_campaigns, active_growth_initiatives,
pending_governance_decisions, active_projects
```

Las listas de `opportunities`, `risks` y `recommendations` se generan con condicionales sobre esos datos reales — no son texto inventado por un modelo de lenguaje. Ejemplos:

- `if (pipeline > 0) opportunities.push(...)`
- `if (criticalTickets > 0) risks.push(...)`
- `if (revenue - costs < 0) risks.push(...)`

El resultado se guarda en `dco_executive_snapshots` y se puede listar con `GET /api/v1/dco/executive`.

## Lo que NO existe aún

- **No hay un LLM generando el análisis.** El "CEO Intelligence Agent" es lógica determinista basada en reglas/umbrales sobre datos reales, no un modelo de IA generativa interpretando la situación del negocio. Si se quiere texto generado por IA, habría que integrar una API de modelo de lenguaje (ej. Claude API) — no está conectada todavía.
- No hay generación automática programada (cron) de snapshots; el usuario debe pulsar "Generar Snapshot CEO" en el dashboard.
- No hay comparación histórica entre snapshots (tendencias) en la interfaz actual, aunque los datos quedan guardados y podrían consultarse.
