# EditCore — Enterprise Operating Model

## Estado actual

El modelo operativo empresarial de EditCore es real y funcional. Cubre organigrama, OKRs, procesos, clientes, reuniones, finanzas y reportes ejecutivos — todos con persistencia en Supabase y APIs REST.

## Tablas en producción

| Tabla | Propósito |
|-------|-----------|
| `biz_org_chart` | Organigrama con roles humanos y agentes IA |
| `biz_processes` | Procesos de negocio con pasos y triggers |
| `biz_okrs` | Objetivos y resultados clave con progreso |
| `biz_customers` | CRM de clientes con contratos y estados |
| `biz_meetings` | Actas y decisiones de reuniones |
| `biz_knowledge_docs` | Base de conocimiento empresarial |
| `biz_finance_records` | Registros financieros por periodo |
| `biz_reports` | Reportes ejecutivos auto-generados |

## APIs disponibles

- `GET/POST /api/v1/enterprise/org-chart` — organigrama; `?init=true` inicializa 11 roles por defecto
- `GET/POST/PATCH /api/v1/enterprise/processes` — procesos; PATCH con `run=true` incrementa run_count
- `GET/POST/PATCH /api/v1/enterprise/okrs` — OKRs; progreso se recalcula automáticamente de key_results
- `GET/POST/PATCH /api/v1/enterprise/customers` — CRM de clientes
- `GET/POST /api/v1/enterprise/meetings` — reuniones y actas
- `GET/POST /api/v1/enterprise/finance` — finanzas con resumen agregado
- `GET/POST /api/v1/enterprise/reports` — reportes ejecutivos con datos reales
- `GET/POST /api/v1/enterprise/knowledge` — base de conocimiento

## Lo que NO existe aún

- Ejecución automática de procesos (cron/webhook) — trigger_type existe en schema pero el runner no está construido
- Integración con Stripe para facturación a clientes
- Exportación de reportes a PDF
- Notificaciones automáticas por email/Slack
