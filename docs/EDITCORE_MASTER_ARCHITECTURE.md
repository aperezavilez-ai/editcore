# EditCore Master Architecture (Prompt 20 — Fase 2)

## Núcleo central

EditCore no tiene un "monolito" central: es un conjunto de funciones serverless (Vercel) sin estado, todas ubicadas bajo `api/v1/<modulo>/<recurso>.ts`, que comparten:

- **Capa de datos**: un único proyecto Supabase (Postgres + Auth), accedido vía `lib/supabaseAdmin.ts` (cliente con service role, solo en backend).
- **Capa de autenticación**: `lib/userAuth.ts` (sesión Supabase Auth), `lib/developerAuth.ts` (API keys `ec_live_...`), `lib/orgAuth.ts` (API key de organización).
- **Capa de razonamiento/gobernanza**: `lib/taskReasoning.ts` (descomposición de objetivos), `lib/aiGovernance.ts` (reglas de autonomía), `lib/modelRouter.ts` (selección de modelo).
- **Capa de automatización externa**: `lib/browserAgent.ts` (Playwright, sin API keys de terceros).

No existe un "kernel" propio de EditCore ejecutándose como proceso persistente: cada request es independiente y la coordinación entre pasos se modela como filas en tablas (`ai_orchestration_runs`, `ai_task_plans`), no como estado en memoria.

## Servicios (módulos)

```
api/v1/
├── agents/        → Marketplace de agentes (community)
├── aios/          → AI Operating System: orquestación, governance, model router
├── architect/     → Architecture Library (patrones, proyectos)
├── browser/       → Browser Agent (Playwright)
├── dco/           → Digital Enterprise (productos, ventas, marketing, soporte, growth, governance, executive)
├── enterprise/    → Enterprise Operating Model (org, OKRs, finanzas, clientes)
├── factory/       → Software Factory (proyectos, tareas, releases)
├── global/        → Global Command Center (agregador, nuevo en este prompt)
├── lab/           → Innovation Lab (ideas, experimentos, research, startups)
└── network/       → Agent Network (equipos, mensajes, knowledge graph, calidad)
```

## Comunicación entre módulos

No hay un bus de mensajes ni cola interna. La comunicación entre módulos ocurre de dos formas, ambas reales y verificables en el código:

1. **Vía base de datos compartida**: un módulo lee tablas de otro directamente con el cliente Supabase (ejemplo: `dco/executive.ts` lee `biz_okrs`, `biz_finance_records` y `factory_projects`).
2. **Vía agregación en la capa de presentación**: `api/v1/global/command-center.ts` (nuevo) consulta en paralelo tablas de 6 módulos distintos y devuelve una vista unificada, sin que los módulos se conozcan entre sí.

No existe comunicación módulo-a-módulo vía HTTP interno (un endpoint llamando a otro endpoint) — se evita a propósito para no introducir latencia ni acoplamiento.

## Flujos de datos

```
Usuario (dashboard HTML)
   → fetch con Bearer token
   → función serverless (api/v1/.../*.ts)
   → resolveUserFromBearerToken / resolveDeveloperKey
   → Supabase (Postgres con RLS)
   → respuesta JSON
   → render en el dashboard
```

Para flujos de inteligencia (orquestación):
```
POST /api/v1/aios/orchestrate
   → checkGovernance() valida el nivel de autonomía
   → decomposeGoal() genera subtareas
   → INSERT en ai_orchestration_runs + ai_task_plans
   → respuesta con el plan
```

## Seguridad

Ver `EDITCORE_SECURITY_FRAMEWORK.md` para el detalle completo. Resumen: RLS en toda tabla de usuario, ninguna clave secreta en el repositorio, 3 mecanismos de autenticación documentados, gobernanza de acciones de agentes con niveles de autonomía.

## Escalabilidad

EditCore hereda el modelo de escalabilidad de sus proveedores (Vercel para cómputo serverless, Supabase para Postgres administrado). No hay código propio de sharding, balanceo o multi-región — ver `EDITCORE_GLOBAL_OPERATION.md`, sección "Lo que NO existe aún", para el detalle honesto de esta brecha.
