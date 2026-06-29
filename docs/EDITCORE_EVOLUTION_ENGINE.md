# EditCore Evolution Engine

Estado: **núcleo real de medición y registro, sin automejora autónoma**.
Existe un sistema real que mide el estado de la plataforma y registra
propuestas de mejora con niveles de aprobación. No existe un motor que
escriba o despliegue código por sí mismo — eso es una decisión de
seguridad explícita, no una limitación que se vaya a "completar" después.

## 1. Lo que sí existe (real, en producción)

- Tabla `evolution_audits` (Supabase, `supabase/migrations/0006_evolution_system.sql`): guarda métricas reales del sistema (conteo de organizaciones, usuarios, claves de API activas, agentes, publicaciones de comunidad, propuestas abiertas) con marca de tiempo.
- `/api/evolution/audit?kind=daily|weekly|monthly` — calcula esas métricas en vivo contra Supabase y las guarda. Protegido con `CRON_SECRET` (variable de entorno, no en el repo).
- `vercel.json` → bloque `crons`: programa la auditoría diaria (06:00 UTC), semanal (lunes 07:00 UTC) y mensual (día 1, 08:00 UTC). **Importante**: los Cron Jobs de Vercel requieren plan Pro para ejecutarse con esta frecuencia; en plan Hobby están limitados (máx. 2 cron jobs, ejecución no garantizada más de una vez al día). Verifica el plan actual de tu proyecto en Vercel antes de asumir que las 3 auditorías corren solas.
- Tabla `evolution_proposals`: cada propuesta tiene `title`, `description`, `level` (1-5, ver `EDITCORE_EVOLUTION_WORKFLOW.md`), `status`, `impact`, `complexity`, `outcome`.
- `/api/evolution/proposals` (GET/POST) y `/api/evolution/audits` (GET) — consumidos por `web/evolution.html` (Centro de Evolución).

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Detección automática de oportunidades por IA**: las propuestas se registran manualmente (por una persona con sesión) o se podrían generar llamando a un modelo de IA contra las métricas de auditoría, pero esa llamada automática no está conectada todavía — hoy `source: 'audit'` existe como valor permitido en la base de datos, pero nada lo genera solo.
- **Implementación automática**: no hay ningún proceso que tome una propuesta aprobada y modifique código, abra un PR o despliegue un cambio. Esto es intencional (Fase 14: seguridad de automejora) — implementar siempre pasa por un humano (vía sesión de Claude Code, como las demás piezas de este repositorio).
- **Evaluación automática de resultados**: el campo `outcome` existe en la tabla pero se llena manualmente; no hay medición automática de si una mejora implementada tuvo el efecto esperado.

## 3. Próximos pasos honestos

1. Conectar `/api/evolution/audit` con una llamada real a un modelo de IA (Claude/OpenAI) que lea las métricas y genere automáticamente propuestas en `evolution_proposals` con `source: 'audit'` — esto sí es técnicamente viable hoy, no tiene prerrequisitos externos pendientes.
2. Generar `EVOLUTION_REPORT.md` automáticamente a partir de las auditorías (hoy las auditorías solo viven en la base de datos y en `web/evolution.html`, no se exportan a Markdown).
3. Definir un proceso manual documentado para mover una propuesta de `approved` a `implemented` referenciando el commit/PR real que la resolvió.
