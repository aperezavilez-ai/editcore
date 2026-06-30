# EditCore Agent Store

Estado: **modelo de datos real, sin tienda ni cobro todavía**. Los agentes ya
existen como recursos de plataforma versionables; lo que falta es la capa de
descubrimiento público y monetización.

## 1. Lo que sí existe (real, en producción)

- Tabla `agent_definitions` (Supabase, `supabase/migrations/0005_agents_and_community.sql`): cada agente es una fila propia (dueño, slug, nombre, descripción, `is_public`, `current_version`), no configuración fija del código de la extensión.
- Tabla `agent_versions`: historial inmutable de versiones por agente (`config` en JSON + `changelog`), nunca se sobrescribe.
- `/api/v1/agents` (GET/POST) — lista agentes públicos (sin sesión) o propios+públicos (con sesión); crea un agente nuevo con su versión 1.
- `/api/v1/agents/:id/versions` (GET/POST) — historial de versiones; agregar una nueva versión solo si eres el dueño.
- Agentes/roles predefinidos del equipo (`extensions/editcore-claude/src/agents/roles.ts`) siguen existiendo aparte, fijos en el código de la extensión — no se migraron a este sistema todavía.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Catálogo público navegable**: `/api/v1/agents` devuelve JSON, pero no hay una página web tipo tienda para explorar agentes públicos.
- **Valoraciones/reviews**: no hay tabla `agent_reviews` ni interfaz para calificar un agente.
- **Monetización**: no hay ningún mecanismo de pago asociado a un agente individual — requiere integrar Stripe primero (ver `EDITCORE_ECOSYSTEM_ARCHITECTURE.md` §2 y `EDITCORE_BILLING_SYSTEM.md`).
- **Instalación directa en la extensión**: hoy nada en `extensions/editcore-claude` consume `/api/v1/agents`; publicar un agente vía API no lo hace utilizable automáticamente dentro del IDE.

## 3. Próximos pasos honestos

1. Página web `web/agent-store.html` que consuma `/api/v1/agents` para explorar agentes públicos.
2. Integrar Stripe para permitir cobro por agente (requiere que el usuario cree la cuenta de Stripe, ver `EDITCORE_ECOSYSTEM_ARCHITECTURE.md`).
3. Conectar la extensión para que pueda importar/instalar un `agent_definitions` público vía `/api/v1/agents/:id/versions`.
4. Tabla y endpoint de valoraciones.
