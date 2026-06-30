# EditCore Tech Radar

Estado: **documento mantenido manualmente, no generado por un agente de
IA todavía**. El Prompt 12 pide un "Tech Research Agent" autónomo que
investigue modelos, frameworks y prácticas nuevas. Eso no existe como
proceso automatizado — lo que existe es este documento, que refleja
decisiones tecnológicas reales ya tomadas en EditCore y candidatos
identificados manualmente.

## 1. Lo que sí existe (real, en el código de EditCore hoy)

- **Modelos de IA en producción**: Claude (Anthropic) como motor principal de la extensión `editcore-claude`; integraciones con OpenAI/OpenRouter también presentes en el código de la extensión para flexibilidad de modelo.
- **Backend**: Vercel (funciones serverless en TypeScript) + Supabase (Postgres + Auth + RLS).
- **IDE**: fork real de Code-OSS (Visual Studio Code de código abierto), no una extensión sobre VS Code de terceros.
- **Frontend web**: HTML/CSS/JS sin framework (sin React/Vue), Supabase JS SDK vía CDN.

## 2. Candidatos identificados (sin investigación automatizada, criterio manual)

| Candidato | Por qué podría importar | Estado |
|---|---|---|
| Rate limiting distribuido (Upstash Redis) | El rate limiting actual de `/api/v1/*` es por instancia de función, no global (ver `EDITCORE_API_PLATFORM.md`) | No integrado |
| Vercel Cron | Ya integrado para las auditorías de evolución (`vercel.json`) | Integrado, primera versión |
| pg_cron de Supabase | Alternativa a Vercel Cron para programar tareas directamente en la base de datos | No evaluado |
| Modelo de IA dedicado a generar propuestas de mejora a partir de métricas | Cerraría la Fase 4 real del Prompt 12 (Tech Research Agent / Opportunity Detection Agent) | No construido, ver `EDITCORE_EVOLUTION_ENGINE.md` §3 |

## 3. Lo que NO existe todavía (honesto, no inventado)

- **TECH RESEARCH AGENT autónomo**: no hay ningún proceso que consulte fuentes externas (papers, releases de modelos, changelogs de frameworks) y actualice este documento solo.
- **Comparación automática de modelos por costo/calidad**: no existe (ver `EDITCORE_AI_LAB.md` y Fase 9 del Prompt 12, tampoco implementada).
- **Alertas de nuevas versiones de dependencias críticas**: no hay ningún bot de actualización de dependencias configurado en este repositorio todavía.

## 4. Próximos pasos honestos

1. Conectar un job (Vercel Cron + llamada a un modelo de IA) que lea changelogs/RSS de proveedores de IA relevantes y proponga actualizaciones a este documento — requiere decidir qué fuentes consultar.
2. Evaluar un bot de dependencias (ej. Dependabot de GitHub, que sí es activable sin construir nada nuevo) para automatizar al menos la parte de "nuevas versiones de librerías usadas".
