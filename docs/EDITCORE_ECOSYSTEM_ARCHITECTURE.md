# EditCore Ecosystem Architecture

Estado: **arrancado parcialmente, mayormente visión**. Este documento consolida,
de forma honesta, el estado de los componentes pedidos para un "ecosistema
global de IA" (Prompt 11) frente a lo que realmente existe en el repositorio
hoy. Las primeras dos filas ya tienen una primera versión real; el resto sigue
sin construirse.

## 1. Mapa real vs. visión

| Componente pedido | Estado real |
|---|---|
| API Platform pública | **Arrancada.** `/api/v1/me` es el primer endpoint público real, con claves de desarrollador propias (ver `EDITCORE_API_PLATFORM.md`). Sigue siendo un solo endpoint, sin rate limiting aplicado ni scopes con efecto real. |
| Developer Portal | **Arrancado.** `web/developers.html` permite crear/listar/revocar claves de API con sesión real (ver `EDITCORE_DEVELOPER_PORTAL.md`). Sin documentación navegable, sandbox ni comunidad todavía. |
| SDKs (JS/TS, Python, etc.) | TypeScript existe como código fuente compilable (`sdk/typescript/`, paquete `@editcore/sdk`), pero no está publicado en npm. Python y otros lenguajes no existen. |
| Plugin Marketplace | No existe ningún mecanismo de plugins de terceros (ver `EDITCORE_PLUGIN_SYSTEM.md`). |
| Agent Store | No existe ninguna tienda de agentes; los agentes son fijos y internos (ver `EDITCORE_AGENT_STORE.md`). |
| Community | No existe ninguna capa social; no hay ni autenticación de usuario individual (ver `EDITCORE_COMMUNITY_SYSTEM.md`). |
| Creator Program | No existe ningún programa de creadores ni monetización de recursos individuales. |
| Agent Version Control | No existe versionado de agentes; no hay agentes como recursos independientes que versionar. |
| Integraciones globales (GitHub, GitLab, CRMs, etc.) | No existen integraciones salientes; el único cliente externo real es Anthropic/OpenAI/OpenRouter para inferencia de IA dentro de la extensión. |
| AI as a Service | No existe oferta de "agentes bajo demanda" como servicio facturable; no hay cobro real todavía (`EDITCORE_BILLING_SYSTEM.md`). |
| Sistema de confianza y seguridad para terceros | No existe verificación de creadores ni revisión de plugins, porque no hay plugins ni creadores externos todavía. |
| Ecosystem Analytics | No existe; no hay métricas de "desarrolladores activos" ni "plugins usados" porque no hay desarrolladores externos ni plugins. |
| Ecosystem Intelligence Agent | No existe ningún agente que analice demanda/tendencias del ecosistema, porque no hay datos de ecosistema que analizar. |

## 2. Por qué el resto no se ha construido todavía

El resto de los componentes depende de prerrequisitos que tampoco existen
todavía en EditCore:

- Un marketplace o agent store requiere modelar "agentes/proyectos" como
  recursos de plataforma versionables — hoy son configuración interna de
  una extensión, no datos en una base de datos multi-tenant abierta — y un
  sistema de pagos/licencias funcional (el cobro real con Stripe tampoco
  está implementado, ver `EDITCORE_BILLING_SYSTEM.md`).
- Una comunidad requiere más que autenticación individual (que ya existe):
  necesita espacios de discusión, perfiles públicos y moderación, ninguno
  construido.
- Ecosystem Analytics e Intelligence Agent requieren que existan
  desarrolladores externos activos y plugins reales que generen datos que
  analizar — hoy no hay ninguno.

Construir cualquiera de estas piezas "para que se vea completo" sin estos
prerrequisitos habría significado simularlas con datos falsos, lo cual va
en contra de la regla de no fabricar funcionalidad inexistente.

## 3. Orden honesto recomendado si se decide avanzar

1. ~~Autenticación de usuario individual~~ — **hecho** (Supabase Auth, login.html/account.html y ahora también dentro del IDE).
2. ~~API pública versionada con API keys de desarrollador~~ — **hecho, primera versión** (`/api/v1/me`, `developer_api_keys`).
3. ~~SDK mínimo en TypeScript~~ — **hecho, primera versión** (`@editcore/sdk`, no publicado en npm todavía).
4. Modelado de "agente" como recurso de plataforma versionable (prerrequisito de Agent Store y Version Control). **Pendiente.**
5. Solo después de lo anterior: marketplace de plugins, agent store con pagos, comunidad, analítica de ecosistema. **Pendiente.**

Los pasos 1 a 3 ya tienen una primera versión real. Los pasos 4 y 5 siguen
sin construirse — son los próximos candidatos honestos si se decide seguir
avanzando en este prompt.
