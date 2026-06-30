# EditCore Global Operation (Prompt 20 — Fases 9, 11, 13)

## Centro de Control Global (Fase 9)

**Implementado realmente en este prompt**: `GET /api/v1/global/command-center` (`api/v1/global/command-center.ts`) y el dashboard `web/global-command-center.html`.

Agrega en una sola respuesta, consultando datos reales (no inventados) de 18 tablas en 6 módulos:

- **Inteligencia**: runs de orquestación (24h), agentes activos/en espera, costo de modelos (24h), propuestas de evolución abiertas.
- **Red de agentes**: equipos totales/activos, nodos y conexiones del knowledge graph.
- **Software Factory**: proyectos totales y en progreso.
- **Innovation Lab**: ideas totales/validadas, experimentos corriendo, startups lanzadas.
- **Empresa Digital**: productos activos, MRR total, pipeline de ventas, tickets de soporte abiertos/críticos, decisiones de gobernanza pendientes, unidades de negocio.
- **Finanzas**: resultado neto, progreso promedio de OKRs.

No reemplaza los dashboards de cada módulo — es una capa de resumen ejecutivo encima de ellos, evitando duplicar su lógica de detalle.

**No existe**: métricas de "salud técnica" de la plataforma (latencia de endpoints, errores 5xx, uptime) — eso requeriría integrar un proveedor de observabilidad (ej. Vercel Analytics, Sentry), no contratado/conectado en este proyecto.

## Escalabilidad global (Fase 11)

### Lo que SÍ existe

- Cómputo serverless sin estado (Vercel) — escala horizontalmente por diseño de la plataforma subyacente, sin configuración adicional de EditCore.
- Postgres administrado (Supabase) con connection pooling gestionado por el proveedor.

### Lo que NO existe aún

- **Multi-región propia**: no hay despliegue configurado en múltiples regiones ni enrutamiento geográfico.
- **Alta disponibilidad diseñada por EditCore**: se hereda el SLA de Vercel/Supabase; no hay réplicas, failover ni runbooks propios.
- **Arquitectura distribuida con colas/eventos**: no hay sistema de mensajería (ej. SQS, Kafka) entre módulos — la comunicación es vía base de datos compartida (ver `EDITCORE_MASTER_ARCHITECTURE.md`).
- **Balanceo de carga propio**: gestionado implícitamente por la capa serverless del proveedor, sin lógica de EditCore.
- **Pruebas de resiliencia (chaos engineering, etc.)**: no realizadas.

Estas son brechas reales y deliberadamente no resueltas en este prompt para no fabricar infraestructura que no existe.

## Experiencia unificada de usuario (Fase 13)

### Lo que SÍ existe

- Un punto de entrada de cuenta (`web/account.html`) que enlaza a los 9+ dashboards de módulo existentes.
- Cada dashboard comparte el mismo mecanismo de sesión (`localStorage.editcore_token`) y estilo visual consistente (tema oscuro, monoespaciado).
- El nuevo Global Command Center da una vista de "todo el negocio" en una sola pantalla con enlaces directos a cada módulo.

### Lo que NO existe aún

- **No hay una interfaz conversacional única** donde el usuario "hable con EditCore" en lenguaje natural y este decida qué módulo/agente usar — eso es lo que pedía la Fase 13 textualmente ("EditCore Intelligent Interface"). Hoy el usuario navega manualmente entre dashboards y llena formularios; el Orquestador Universal (Fase 4) existe a nivel de API pero no está conectado a una UI de chat.
- Construir esa interfaz conversacional requeriría conectar un modelo de lenguaje real (vía API, con clave del usuario) a `POST /api/v1/aios/orchestrate` y a los demás endpoints — no implementado en este prompt para no inventar una integración de IA generativa sin la clave correspondiente del usuario.
