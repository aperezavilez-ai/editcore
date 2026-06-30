# EditCore Company Operating Model (Prompt 19)

## Qué es

Documenta cómo encajan entre sí las distintas áreas operativas digitales de EditCore (ventas, marketing, soporte, producto, finanzas, equipo) y qué partes están realmente automatizadas vs. son solo registro de datos.

## Áreas y su estado real

| Área | Tabla(s) | Automatización real | Manual |
|---|---|---|---|
| Producto | `dco_products` | — | Alta, edición de estado/roadmap |
| Ventas | `dco_leads`, `dco_proposals` | Cálculo de pipeline ponderado | Captura de leads, redacción de propuestas |
| Marketing | `dco_campaigns` | — | Creación y seguimiento de campañas |
| Soporte | `dco_support_tickets` | Auto-asignación de agente por categoría (etiqueta, no IA generativa) | Resolución real por persona o agente externo |
| Crecimiento | `dco_growth_initiatives` | — | Definición de métricas objetivo y seguimiento |
| Finanzas | `biz_finance_records` (Prompt 17, reutilizado) | Cálculo de revenue/costos netos en snapshot ejecutivo | Registro de movimientos |
| Equipo | `agent_teams` / `agent_messages` (Prompt 16, reutilizado) | — | Gestión de equipos de agentes existente |
| Gobernanza | `dco_governance_decisions` | — | Registro y decisión humana obligatoria por defecto (`requires_human = true`) |

## Decisión de diseño: no se crearon tablas nuevas de Finanzas/Equipo

El Prompt 19 pedía "AI Financial Intelligence" y "AI Team Management". Para no duplicar ni fabricar sistemas que ya existen, estas fases reutilizan:

- **AI Financial Intelligence** → `biz_finance_records` y `biz_okrs` (Prompt 17). El snapshot ejecutivo (`dco_executive_snapshots`) ya consulta estas tablas para calcular `net_revenue_usd_cents` y `avg_okr_progress`.
- **AI Team Management** → `agent_teams` y `agent_messages` (Prompt 16). No se agregó tabla nueva porque el sistema de equipos de agentes ya cubre esa función.

## Lo que NO existe aún

- No hay un "orquestador" que mueva automáticamente datos entre áreas (ej. que un lead ganado cree automáticamente un producto o ticket).
- No hay reglas de negocio automatizadas (ej. alertas automáticas por SLA vencido).
