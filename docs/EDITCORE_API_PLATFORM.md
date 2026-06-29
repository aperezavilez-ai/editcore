# EditCore API Platform

Estado: **arrancada, primera versión real**. EditCore ahora expone una API
pública versionada (`/api/v1/*`) con claves de desarrollador propias,
separadas de la clave de organización. Es deliberadamente mínima — un solo
endpoint real — para no fabricar recursos que no existen.

## 1. Lo que sí existe (real, en producción)

- Tabla `developer_api_keys` (Supabase, `supabase/migrations/0004_developer_api_keys.sql`): claves por usuario individual (vinculadas a `auth.users`, no a una organización), con hash SHA-256, prefijo visible, scopes, `rate_limit_per_minute`, `is_active`, `expires_at`.
- `lib/developerAuth.ts` — genera y valida claves (`ec_live_...`), header `x-editcore-api-key`; expone `hasScope()` y `checkRateLimit()`.
- `/api/developer/keys` (GET/POST/DELETE) — requiere sesión de Supabase Auth (Bearer token, la misma cuenta de `login.html`). Crea, lista y revoca claves. La clave en texto plano solo se devuelve una vez, al crearla.
- `/api/v1/me` (GET) — primer endpoint público real: valida la `x-editcore-api-key`, exige el scope `api:read`, aplica rate limiting, y devuelve `{ authenticated: true, scopes: [...] }` con headers `X-RateLimit-Limit`/`X-RateLimit-Remaining`. Es la base para futuros endpoints versionados.
- **Rate limiting real, con una limitación honesta**: `checkRateLimit()` cuenta solicitudes por clave en una ventana de 60s, en memoria del proceso de la función serverless. Funciona de verdad (responde `429` al exceder el límite), pero **no es un contador global distribuido**: cada instancia de Vercel lleva su propio conteo, así que el límite real efectivo puede ser mayor que `rate_limit_per_minute` si Vercel escala a varias instancias. Un límite global requeriría un store compartido (ej. Upstash Redis), que no existe todavía.
- **Scopes con efecto real**: `/api/v1/me` ahora rechaza con `403` una clave sin el scope `api:read`. Sigue habiendo un solo scope definido; no hay un catálogo de scopes más amplio todavía.
- `web/developers.html` — portal real donde un usuario logueado crea/revoca sus propias claves desde el navegador.
- `sdk/typescript/` — paquete `@editcore/sdk` (no publicado en npm todavía, pero compila y funciona localmente) con un cliente mínimo: `new EditCoreClient({ apiKey }).me()`.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Recursos de plataforma reales**: no hay "proyectos", "agentes publicables", "automatizaciones" ni "plantillas" como entidades en la base de datos. `/api/v1/me` es el único endpoint — confirma que la clave funciona, nada más.
- **Rate limiting distribuido**: el conteo es por instancia de función serverless, no global (ver limitación arriba).
- **Documentación OpenAPI/Swagger**: no existe, solo este documento y el ejemplo de `curl` en `developers.html`.
- **SDK publicado**: `@editcore/sdk` existe como código fuente compilable en el repo, pero no se ha publicado a npm.
- **Catálogo de scopes**: solo existe `api:read`; no hay scopes de escritura ni un sistema de permisos más granular.

## 3. Próximos pasos honestos

1. Rate limiting distribuido real (Upstash Redis u otro store compartido) en vez del conteo por instancia actual.
2. Agregar el primer recurso real de plataforma (candidato: agentes personalizados como configuración exportable, ver `EDITCORE_AGENT_STORE.md`).
3. Publicar `@editcore/sdk` en npm.
4. Generar especificación OpenAPI a partir de los endpoints reales (no antes, para no documentar lo que no existe).
