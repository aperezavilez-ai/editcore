# EditCore Gap Analysis (Prompt 21 — Fase 3)

Comparación de la plataforma real contra la visión declarada en los prompts 16-20, clasificada por severidad.

## CRÍTICO

| Brecha | Módulo | Detalle |
|---|---|---|
| Sin pruebas automatizadas en backend web | Todos (`api/`, `lib/`) | Ningún cambio en `lib/aiGovernance.ts`, `lib/modelRouter.ts`, etc. está protegido por tests. Un refactor puede romper silenciosamente la gobernanza de IA o el enrutamiento de modelos. |
| Sin CI sobre `api/`/`lib/` | Plataforma | El CI existente (`editcore-ci.yml`) solo cubre extensiones del IDE; el backend web se valida manualmente en cada sesión. |
| Sin integración real de LLM | AI Operating System | El "cerebro" de IA (orquestador, model router) decide *qué* modelo usar pero no hay ninguna llamada real a OpenAI/Claude API en el código — son recomendaciones sin ejecución. |

## IMPORTANTE

| Brecha | Módulo | Detalle |
|---|---|---|
| Orquestador no ejecuta sus planes | AI Operating System | `aios/orchestrate.ts` genera y guarda un plan de subtareas, pero nada lo ejecuta automáticamente. |
| Sin interfaz conversacional unificada | Experiencia de usuario | El usuario opera EditCore navegando 14 dashboards distintos, no "hablando" con la plataforma (documentado ya en `EDITCORE_GLOBAL_OPERATION.md`). |
| Dos generaciones de rutas API conviviendo | Backend | `api/{legacy}` vs `api/v1/{módulo}` — no rompe nada hoy, pero divide el conocimiento de "dónde está cada cosa". |
| Stripe sin activar | Business Platform | Dependencia instalada, pero sin claves reales configuradas (requiere acción del usuario en su propio dashboard de Stripe). |
| Documentación con nombres solapados | `docs/` | Mínimo 2 pares de archivos con títulos casi idénticos y contenido distinto (`CORE_INTELLIGENCE` vs `INTELLIGENCE_CORE`, y el cluster de 4 docs de "arquitectura de IA"). |

## MEJORA

| Brecha | Módulo | Detalle |
|---|---|---|
| Sin observabilidad | Plataforma | No hay logs estructurados, métricas de error ni APM conectado. El Optimization Engine (Prompt 20) no puede detectar cuellos de botella reales sin esto. |
| Sin rate limiting propio | Seguridad | Se depende íntegramente de los límites de Vercel. |
| Sin rotación de API keys | Seguridad | Las developer keys no expiran ni rotan automáticamente. |
| Dashboards sin reutilización de UI | Frontend | Cada `web/*.html` repite su propio CSS/JS — funciona, pero es ~14x el código de UI que con componentes compartidos. |

## FUTURO

| Brecha | Módulo | Detalle |
|---|---|---|
| Multi-región / alta disponibilidad propia | Infraestructura | Hoy se hereda el modelo de Vercel/Supabase; no se justifica construir esto sin tráfico real que lo requiera. |
| Ejecución automática de workflows | Workflow Intelligence | Requiere primero resolver la integración de LLM real (CRÍTICO) antes de tener sentido. |
| Optimization Engine automático | Evolution Engine | Depende de observabilidad real (MEJORA) — sin datos de rendimiento no hay nada que optimizar automáticamente. |
| Migración completa a rutas `/v1` | Backend | Bajo riesgo si se hace, pero sin urgencia mientras no cause confusión operativa real. |

## Resumen por severidad

- **3 críticos**: ausencia de tests/CI en backend web, ausencia de integración real de LLM.
- **5 importantes**: principalmente "lo que falta para que la IA sea generativa de verdad" y deuda de organización (rutas, docs).
- **4 mejoras**: observabilidad, seguridad operativa, reutilización de frontend.
- **4 futuros**: todo lo que depende de resolver primero los críticos.
