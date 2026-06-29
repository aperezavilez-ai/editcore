# EditCore SaaS Architecture

Estado: **parcialmente real**. Este documento describe exactamente qué partes
de la arquitectura SaaS de EditCore están desplegadas y funcionando hoy, y
cuáles son trabajo futuro (no inventado, no simulado).

## 1. Componentes reales (en producción)

| Componente | Tecnología | Estado |
|---|---|---|
| Base de datos multi-tenant | Supabase (Postgres + RLS) | Real, desplegado |
| API backend | Vercel Serverless Functions (Node.js, TypeScript) | Real, desplegado en `editcore.mx` |
| Sitio web / landing | Vercel (estático, carpeta `web/`) | Real, desplegado |
| Extensión VS Code | TypeScript, VS Code Extension API | Real, en el repo, no publicada en marketplace de VS Code |
| Autenticación de la extensión hacia el backend | Clave opaca por organización (`x-editcore-org-key`) | Real |

Repositorio único (`aperezavilez-ai/editcore`), un solo proyecto Vercel sirve
tanto la web estática (`outputDirectory: web`) como las funciones serverless
(`api/**/*.ts` en la raíz del repo).

## 2. Esquema de datos real

Definido en `supabase/migrations/0001_init.sql`:

- `organizations` — id, name, plan, created_at.
- `profiles` — vincula `auth.users` de Supabase con una organización y un rol.
- `subscriptions` — datos de Stripe (customer id, subscription id, plan, status) — **tabla existe, no hay integración con Stripe todavía** (ver `EDITCORE_BILLING_SYSTEM.md`).
- `usage_events` — cada evento de consumo de IA (tokens, costo, modelo, proveedor, herramienta).
- `plan_limits` — límites de tokens/asientos/almacenamiento por plan, precargados.
- `organization_api_keys` — claves opacas hasheadas (SHA-256) por organización.

Todas las tablas relevantes tienen Row Level Security activado, con políticas
de `select` que filtran por la organización del usuario autenticado vía
`profiles.organization_id = auth.uid()`. `plan_limits` es de lectura pública
(no expone datos de ninguna organización).

## 3. Endpoints reales

| Endpoint | Método | Función |
|---|---|---|
| `/api/org/plan` | GET | Devuelve organización + suscripción asociada a la clave |
| `/api/usage/summary` | GET | Devuelve consumo del mes actual vs. límite del plan |
| `/api/usage/track` | POST | Registra un evento de consumo de IA |

Los tres requieren el header `x-editcore-org-key`. Sin él, o con una clave
inválida/revocada, responden `401` con un JSON de error.

## 4. Integración con la extensión

`extensions/editcore-claude/src/enterprise/orgBackend.ts` implementa el
cliente. La clave de organización se guarda con `context.secrets` (cifrado
por VS Code, nunca en texto plano en disco). Comandos disponibles:

- `EditCore: Conectar con organización (backend)`
- `EditCore: Ver plan y consumo de la organización`
- `EditCore: Desconectar organización (backend)`

Cada vez que se registra uso real de un modelo (`ApiKeyService.recordUsage`),
si hay una clave de organización configurada, se envía automáticamente un
evento a `/api/usage/track` (de forma asíncrona, sin bloquear ni romper nada
si el backend no responde).

## 4.1 Autenticación de usuario individual (nuevo, real pero incompleto)

Primer paso real hacia login por usuario (no solo clave de organización
compartida), usando Supabase Auth (magic link por correo):

- `web/login.html` — pide el correo y llama a `supabase.auth.signInWithOtp`.
- `web/account.html` — lee la sesión de Supabase, llama a `/api/auth/me` con el `access_token` como Bearer, y muestra usuario + organización + plan + rol.
- `/api/auth/me` (GET) — verifica el JWT contra Supabase (`auth.getUser`), busca el `profile` (tabla `profiles`, ya vinculada a `auth.users`) y la organización asociada.
- `lib/userAuth.ts` — `resolveUserFromBearerToken` y `getProfile`, paralelos a `lib/orgAuth.ts` pero para usuarios individuales en vez de claves de organización.

**Estado actual**: `web/assets/supabase-config.js` ya tiene la clave `anon`
real del proyecto Supabase de EditCore (segura para exponer en el cliente,
distinta de `service_role`), así que el login por magic link ya puede
probarse en producción. Lo único pendiente para que un usuario nuevo vea su
organización en `/account.html` es asignarle manualmente `organization_id`
en la tabla `profiles` (no hay flujo de invitación automático todavía).

## 5. Lo que NO existe todavía (honesto, no inventado)

- **Signup / OAuth / SSO**: el login por magic link ya existe (ver 4.1), pero no hay registro propio (today cualquiera con acceso a Supabase Auth puede pedir un magic link), ni OAuth con terceros, ni SSO empresarial.
- **Flujo de invitación a organización**: no hay manera de invitar a un usuario nuevo y asignarle automáticamente una organización; hoy se hace a mano en la tabla `profiles`.
- **Panel de administración web** (crear orgs, rotar claves, ver todas las organizaciones): no existe interfaz; todo se gestiona hoy vía SQL directo en Supabase.
- **Webhooks de Stripe** y cobro real: no implementado (ver `EDITCORE_BILLING_SYSTEM.md`).
- **Multi-región / alta disponibilidad**: es la configuración por defecto de Supabase/Vercel, sin configuración adicional.
- **Tests automatizados del backend**: no existen todavía.

## 6. Próximos pasos sugeridos (no implementados)

1. Endpoint de administración para crear organizaciones y rotar claves sin SQL manual.
2. Integración de Stripe Checkout + webhook para que `subscriptions` se actualice solo.
3. Página web de login para que cada usuario tenga su propia sesión (en vez de clave compartida por organización).
