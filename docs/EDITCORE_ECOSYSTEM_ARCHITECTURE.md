# EditCore Ecosystem Architecture

Estado: **prerrequisitos técnicos completos, capas de negocio pendientes**.
Este documento consolida, de forma honesta, el estado de los componentes
pedidos para un "ecosistema global de IA" (Prompt 11) frente a lo que
realmente existe en el repositorio hoy.

## 1. Mapa real vs. visión

| Componente pedido | Estado real |
|---|---|
| API Platform pública | **Real.** `/api/v1/me` y `/api/v1/agents` con claves de desarrollador, scope `api:read` exigido y rate limiting aplicado (ver `EDITCORE_API_PLATFORM.md`). |
| Developer Portal | **Real.** `web/developers.html` permite crear/listar/revocar claves de API con sesión real (ver `EDITCORE_DEVELOPER_PORTAL.md`). Sin documentación navegable ni sandbox separado todavía. |
| SDKs (JS/TS, Python, etc.) | TypeScript existe como código fuente compilable (`sdk/typescript/`, paquete `@editcore/sdk`), pero no está publicado en npm. Python y otros lenguajes no existen. |
| Agent Version Control | **Real.** `agent_definitions` + `agent_versions` (Supabase, `0005_agents_and_community.sql`): cada agente es un recurso de base de datos con historial de versiones inmutable (`/api/v1/agents/:id/versions`), no configuración fija de la extensión. |
| Community | **Real, básica.** `community_posts` + `community_comments`, página `web/community.html`: cualquiera lee, usuarios con sesión publican y comentan. Sin perfiles públicos, moderación, ni reputación. |
| Plugin Marketplace | No existe ningún mecanismo de plugins de terceros (ver `EDITCORE_PLUGIN_SYSTEM.md`). Bloqueado por falta de pagos reales (ver sección 2). |
| Agent Store | El modelo de datos ya existe (`agent_definitions` es público/privado), pero no hay tienda ni cobro: publicar un agente hoy no genera ingresos ni tiene página de listado dedicada. |
| Creator Program | No existe ningún programa de creadores ni monetización de recursos individuales — depende de Stripe (ver sección 2). |
| Integraciones globales (GitHub, GitLab, CRMs, etc.) | No existen integraciones salientes; requieren registrar una OAuth App por proveedor (ver sección 2). |
| AI as a Service | No existe oferta de "agentes bajo demanda" como servicio facturable; no hay cobro real todavía (`EDITCORE_BILLING_SYSTEM.md`). |
| Sistema de confianza y seguridad para terceros | No existe verificación de creadores ni revisión de plugins, porque no hay plugins ni creadores externos todavía. |
| Ecosystem Analytics | No existe; no hay métricas de "desarrolladores activos" ni "plugins usados" porque no hay desarrolladores externos ni plugins. |
| Ecosystem Intelligence Agent | No existe ningún agente que analice demanda/tendencias del ecosistema, porque no hay datos de ecosistema que analizar. |

## 2. Por qué el resto no se ha construido todavía

Lo que queda depende de algo que **solo el dueño del proyecto puede hacer**:
crear cuentas en servicios externos y entregar sus claves (que nunca se
guardan en el repositorio, se configuran como variables de entorno en
Vercel). Ningún agente puede crear esas cuentas en tu nombre.

- **Stripe (pagos reales)** — bloquea Plugin Marketplace, Agent Store con
  cobro, Creator Program y AI as a Service. Pasos para activarlo cuando se
  decida: crear cuenta en https://dashboard.stripe.com/register, activar
  el modo de pruebas, copiar la clave secreta (`sk_test_...` o `sk_live_...`)
  y pegarla directamente en Vercel → Settings → Environment Variables como
  `STRIPE_SECRET_KEY` (nunca en un archivo del repo).
- **GitHub OAuth App** — bloquea integraciones globales con GitHub. Pasos:
  crear la app en https://github.com/settings/developers → "New OAuth App",
  poner como Authorization callback URL `https://editcore.mx/api/integrations/github/callback`,
  copiar `Client ID` y `Client Secret`, y pegarlos en Vercel como
  `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`.
- **Ecosystem Analytics / Intelligence Agent** — no requieren cuenta
  externa, pero sí que existan desarrolladores y agentes públicos activos
  generando datos reales que analizar. Con `agent_definitions` y
  `developer_api_keys` ya existiendo, esto se puede construir en cuanto
  haya tráfico real que medir; hoy las tablas existen pero están vacías.

Construir cualquiera de estas piezas sin sus prerrequisitos habría
significado simularlas con datos falsos, lo cual va en contra de la regla
de no fabricar funcionalidad inexistente.

## 3. Orden honesto, actualizado

1. ~~Autenticación de usuario individual~~ — **hecho**.
2. ~~API pública versionada con API keys de desarrollador~~ — **hecho**.
3. ~~SDK mínimo en TypeScript~~ — **hecho, no publicado en npm**.
4. ~~Modelado de "agente" como recurso de plataforma versionable~~ — **hecho** (`agent_definitions`/`agent_versions`).
5. ~~Comunidad básica (publicaciones y comentarios)~~ — **hecho**.
6. Integrar Stripe real → desbloquea Marketplace, Agent Store con cobro, Creator Program. **Pendiente de que el usuario cree la cuenta.**
7. Registrar GitHub OAuth App → desbloquea integraciones globales. **Pendiente de que el usuario cree la app.**
8. Ecosystem Analytics / Intelligence Agent sobre datos reales de uso. **Pendiente de tráfico real que analizar.**

Los pasos 1 a 5 son prerrequisitos técnicos y ya están completos. Los pasos
6 a 8 requieren una decisión y una acción del usuario fuera del código (crear
cuentas externas); en cuanto se entreguen esas claves, se pueden construir
los endpoints reales sin más bloqueos técnicos.
