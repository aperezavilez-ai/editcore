# EditCore API Platform

Estado: **no implementado**. Hoy EditCore expone únicamente 3 endpoints
internos para la extensión (organización, plan, consumo), no una plataforma
de API pública para terceros. Este documento distingue lo real de la visión.

## 1. Lo que sí existe (base real, no pública)

- 3 endpoints en producción (`editcore.mx`), pensados para la extensión, no para terceros: `/api/org/plan`, `/api/usage/summary`, `/api/usage/track` (ver `EDITCORE_SAAS_ARCHITECTURE.md`).
- Autenticación por clave opaca de organización (`x-editcore-org-key`, hash SHA-256 en `organization_api_keys`) — el mecanismo de auth ya es real y podría reutilizarse como base de API keys públicas, pero hoy solo da acceso a esos 3 endpoints, no a "proyectos, agentes, automatizaciones, plantillas, flujos de trabajo" (ninguno de esos conceptos existe como recurso en la base de datos).

## 2. Lo que NO existe todavía (honesto, no inventado)

- **API pública documentada**: no hay ningún endpoint pensado para que un desarrollador externo (fuera de la propia extensión) construya integraciones.
- **Recursos de la plataforma**: no existen tablas ni endpoints para "proyectos", "agentes" (como entidad publicable), "automatizaciones", "plantillas" o "flujos de trabajo". Lo que hoy se llama "agente" en el código (`extensions/editcore-claude/src/agents/roles.ts`) es una configuración local de prompts dentro de la extensión, no un recurso de plataforma con API propia.
- **Sistema de API keys para terceros**: las claves actuales son de organización (acceso administrativo a uso/plan), no claves de desarrollador con scopes/permisos granulares.
- **Límites de tasa (rate limiting)**: no implementado en ningún endpoint.
- **Documentación pública de API** (tipo OpenAPI/Swagger): no existe.

## 3. Plan honesto para implementarlo (no construido aún)

1. Definir qué recursos son realmente publicables (empezar por "agentes" como configuración exportable) y modelarlos en Supabase.
2. Endpoint `/api/v1/...` versionado, separado de los endpoints internos actuales.
3. Sistema de API keys de desarrollador con scopes (lectura/escritura por recurso) distinto de la clave de organización.
4. Rate limiting (ej. con un contador en Supabase o un servicio externo tipo Upstash).
5. Especificación OpenAPI generada y publicada.

Nada de esto está construido. La "plataforma de API pública" es, hoy, una
visión sobre una base de autenticación real pero muy limitada.
