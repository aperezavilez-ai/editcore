# EditCore Real Architecture Map (Prompt 21 — Fase 2)

Mapa de la arquitectura tal como existe en código hoy, no como se planeó. Complementa (no reemplaza) `EDITCORE_MASTER_ARCHITECTURE.md` del Prompt 20 con el detalle de las dos generaciones de rutas y los puntos críticos detectados en la Fase 1.

## Componentes actuales

```
┌─────────────────────────────────────────────────────────┐
│ web/*.html (14 dashboards, sin build, fetch directo)     │
└───────────────┬─────────────────────────────────────────┘
                 │ Bearer token (localStorage.editcore_token)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Vercel Serverless Functions                              │
│  ├─ api/{auth,community,developer,evolution,org,usage}/* │  ← generación legacy (pre-/v1)
│  └─ api/v1/{agents,aios,architect,browser,dco,enterprise, │  ← generación /v1 (Prompts 16-20)
│            factory,global,lab,network}/*                 │
└───────────────┬─────────────────────────────────────────┘
                 │ lib/userAuth.ts | lib/developerAuth.ts | lib/orgAuth.ts
                 │ lib/supabaseAdmin.ts (service role)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Supabase Postgres — 13 migraciones, RLS por tabla         │
└─────────────────────────────────────────────────────────┘

(Aparte, sin tocar el backend web:)
┌─────────────────────────────────────────────────────────┐
│ orchestrator.ts + extensions/editcore-claude +            │
│ extensions/editcore-connect + sdk/  → IDE de escritorio   │
│ (fork de Code-OSS), build/CI propio, no llama al backend  │
│ web salvo donde el usuario configure su propia cuenta.    │
└─────────────────────────────────────────────────────────┘
```

## Comunicación entre módulos

- **Frontend → Backend**: HTTP/fetch estándar, un dashboard por módulo, sin estado compartido entre pestañas del navegador más allá del token en `localStorage`.
- **Backend → Backend**: no hay llamadas HTTP internas entre funciones serverless. La integración entre módulos ocurre **a través de la base de datos compartida** (un módulo lee tablas de otro, ej. `dco/executive.ts` lee `biz_okrs`) o **a través de un agregador de solo lectura** (`api/v1/global/command-center.ts`, Prompt 20).
- **IDE de escritorio ↔ backend web**: no hay acoplamiento en tiempo de ejecución; son dos productos que comparten repositorio pero se despliegan y ejecutan por separado.

## Flujo de datos típico (request de escritura)

```
1. Dashboard HTML arma el body y hace fetch con Authorization: Bearer <token>
2. Función serverless valida el token (resolveUserFromBearerToken / resolveDeveloperKey)
3. Valida campos requeridos del body (sin librería de validación de esquemas — checks manuales if/return)
4. INSERT/UPDATE vía supabase-js (service role, bypassa RLS deliberadamente porque ya se filtró por user_id en la query)
5. Devuelve JSON con el recurso creado/actualizado
```

## Dependencias críticas

- **`lib/supabaseAdmin.ts`**: punto único de acceso a la base de datos. Si falla la conexión o cambian las credenciales, **todo** el backend deja de funcionar — es la dependencia más crítica de toda la plataforma.
- **`lib/userAuth.ts`**: usado por prácticamente todos los endpoints de `/v1/*`. Un bug aquí afecta a todos los módulos simultáneamente.
- **`vercel.json` crons → `api/evolution/audit.ts`**: única automatización programada (cron) que existe realmente en la plataforma; todo lo demás se dispara manualmente desde un dashboard.

## Puntos críticos (riesgo si fallan)

| Punto crítico | Por qué | Mitigación actual |
|---|---|---|
| `lib/supabaseAdmin.ts` | Single point of failure de datos | Ninguna (depende de disponibilidad de Supabase) |
| `lib/userAuth.ts` | Usado por ~40 endpoints | Ninguna prueba automatizada que lo cubra |
| Convivencia de 2 generaciones de rutas (`api/*` legacy vs `api/v1/*`) | Confusión futura sobre dónde agregar funcionalidad nueva | Documentado aquí; sin plan de migración ejecutado todavía |
| Ausencia de CI sobre `api/`/`lib/` | Un cambio puede romper tipos/lógica sin que nada lo detecte antes de producción | Validación manual con `tsc --noEmit` en cada sesión de prompt |
| Sin tests | Regresiones silenciosas al modificar lógica compartida (ej. `lib/aiGovernance.ts`) | Ninguna |
