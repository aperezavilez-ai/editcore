# EditCore Ecosystem Architecture

Estado: **visión documentada, no implementada**. Este documento consolida,
de forma honesta, el estado de los componentes pedidos para un "ecosistema
global de IA" (Prompt 11) frente a lo que realmente existe en el repositorio
hoy.

## 1. Mapa real vs. visión

| Componente pedido | Estado real |
|---|---|
| API Platform pública | No existe. Solo 3 endpoints internos para la extensión (ver `EDITCORE_API_PLATFORM.md`). |
| Developer Portal | No existe ningún portal, sandbox ni claves de prueba (ver `EDITCORE_DEVELOPER_PORTAL.md`). |
| SDKs (JS/TS, Python, etc.) | No existen. No hay ningún paquete publicado en npm/PyPI que envuelva la API. |
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

## 2. Por qué no se construyó nada de esto ahora

Cada uno de estos componentes depende de prerrequisitos que tampoco existen
todavía en EditCore:

- Una API pública real requiere primero modelar "agentes/proyectos/flujos"
  como recursos de plataforma — hoy son configuración interna de una
  extensión de VS Code, no datos en una base de datos multi-tenant abierta.
- Un marketplace o agent store requiere un sistema de pagos/licencias
  funcional — el cobro real (Stripe) ni siquiera está implementado para el
  producto actual (ver `EDITCORE_BILLING_SYSTEM.md`).
- Una comunidad requiere autenticación de usuario individual — hoy solo
  existe autenticación por organización compartida.

Construir cualquiera de estas piezas "para que se vea completo" sin estos
prerrequisitos habría significado simularlas con datos falsos, lo cual va
en contra de la regla de no fabricar funcionalidad inexistente.

## 3. Orden honesto recomendado si se decide avanzar

1. Autenticación de usuario individual (prerrequisito de Community y Creator Program).
2. Modelado de "agente" como recurso de plataforma versionable (prerrequisito de Agent Store y Version Control).
3. API pública versionada sobre ese modelo, con API keys de desarrollador con scopes.
4. SDK mínimo (TypeScript primero, reutilizando el cliente HTTP ya usado en la extensión) que consuma esa API.
5. Solo después de lo anterior: marketplace de plugins, agent store con pagos, analítica de ecosistema.

Ninguno de estos 5 pasos está construido. Este documento es el punto de
partida honesto para decidir, junto con el usuario, cuál de ellos vale la
pena construir de verdad primero.
