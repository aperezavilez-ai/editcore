# EditCore API Platform

Estado: **arrancada, primera versión real**. EditCore ahora expone una API
pública versionada (`/api/v1/*`) con claves de desarrollador propias,
separadas de la clave de organización. Es deliberadamente mínima — un solo
endpoint real — para no fabricar recursos que no existen.

## 1. Lo que sí existe (real, en producción)

- Tabla `developer_api_keys` (Supabase, `supabase/migrations/0004_developer_api_keys.sql`): claves por usuario individual (vinculadas a `auth.users`, no a una organización), con hash SHA-256, prefijo visible, scopes, `rate_limit_per_minute` (campo guardado, **no enforced todavía**), `is_active`, `expires_at`.
- `lib/developerAuth.ts` — genera y valida claves (`ec_live_...`), header `x-editcore-api-key`.
- `/api/developer/keys` (GET/POST/DELETE) — requiere sesión de Supabase Auth (Bearer token, la misma cuenta de `login.html`). Crea, lista y revoca claves. La clave en texto plano solo se devuelve una vez, al crearla.
- `/api/v1/me` (GET) — primer endpoint público real: valida la `x-editcore-api-key` y devuelve `{ authenticated: true, scopes: [...] }`. Es la base para futuros endpoints versionados.
- `web/developers.html` — portal real donde un usuario logueado crea/revoca sus propias claves desde el navegador.
- `sdk/typescript/` — paquete `@editcore/sdk` (no publicado en npm todavía, pero compila y funciona localmente) con un cliente mínimo: `new EditCoreClient({ apiKey }).me()`.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Recursos de plataforma reales**: no hay "proyectos", "agentes publicables", "automatizaciones" ni "plantillas" como entidades en la base de datos. `/api/v1/me` es el único endpoint — confirma que la clave funciona, nada más.
- **Rate limiting real**: el campo `rate_limit_per_minute` se guarda pero ningún middleware lo aplica todavía.
- **Documentación OpenAPI/Swagger**: no existe, solo este documento y el ejemplo de `curl` en `developers.html`.
- **SDK publicado**: `@editcore/sdk` existe como código fuente compilable en el repo, pero no se ha publicado a npm.
- **Scopes con efecto real**: la columna `scopes` existe y se guarda (`api:read` por defecto), pero ningún endpoint todavía rechaza una llamada por scope insuficiente.

## 3. Próximos pasos honestos

1. Aplicar rate limiting real sobre `/api/v1/*` usando `rate_limit_per_minute`.
2. Agregar el primer recurso real de plataforma (candidato: agentes personalizados como configuración exportable, ver `EDITCORE_AGENT_STORE.md`).
3. Publicar `@editcore/sdk` en npm.
4. Generar especificación OpenAPI a partir de los endpoints reales (no antes, para no documentar lo que no existe).
