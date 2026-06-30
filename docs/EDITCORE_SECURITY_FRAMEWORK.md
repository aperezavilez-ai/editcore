# EditCore Security Framework (Prompt 20 — Fases 8, 12)

## AI Trust Framework (Fase 8)

Implementado realmente en `lib/aiGovernance.ts` + tabla `ai_governance_rules` (migración 0009), expuesto en `api/v1/aios/governance.ts`:

- **Niveles de autonomía (1-5)**: Asistente, Analista, Ejecutor supervisado, Operador autónomo, Optimización continua. Definidos en `AUTONOMY_LEVELS`.
- **Permisos por tipo de acción**: `read_files`, `write_files`, `git_commit`, `deploy`, `delete_data`, `modify_secrets`, `api_call`, `create_agent`, `send_message`, `access_billing`. Cada uno tiene un nivel mínimo de autonomía y si requiere aprobación humana (`requires_approval`).
- **Reglas explícitamente bloqueadas siempre**: `modify_secrets` (nivel mínimo 99, es decir, nunca autónomo) y `delete_data`/`access_billing` requieren nivel 5 + aprobación.
- **Auditoría**: cada decisión de gobernanza puede consultarse vía `GET /api/v1/aios/governance` (reglas) y queda evidencia en `dco_governance_decisions` para decisiones de negocio (Prompt 19) y en `ai_orchestration_runs.autonomy_level` para ejecuciones de IA.
- **Explicabilidad**: `checkGovernance()` siempre devuelve un `reason` en texto legible junto con `allowed`/`requires_human_approval`.

**No existe** un sistema de auditoría centralizado e inmutable (ej. log append-only firmado) — las decisiones quedan en tablas Postgres normales, editables por quien tenga acceso de service role.

## Seguridad global (Fase 12)

### Lo que SÍ existe (real)

- **Row Level Security (RLS)** habilitado en toda tabla de usuario desde la migración 0005 en adelante, con política `auth.uid() = user_id` (o `is_public.eq.true OR user_id.eq.<uid>` para recursos compartidos como `knowledge_nodes`).
- **Gestión de identidades**: Supabase Auth (email/password, sesión vía JWT) para usuarios finales; API keys propias (`ec_live_...`, tabla de developer keys, migración 0004) para integraciones de desarrolladores; API key de organización (`x-editcore-org-key`) para acceso a nivel de cuenta.
- **Regla de manejo de secretos del proyecto**: ninguna clave/API key se escribe jamás en el repositorio; toda credencial de terceros se pega directamente en el dashboard del proveedor correspondiente (Vercel, Supabase, Stripe, etc.), nunca en código ni en `.env` versionado.
- **Seguridad de APIs**: toda función serverless valida Bearer token o API key antes de tocar datos; sin excepción revisada en los módulos auditados (Prompt 20, Fase 1).
- **Control de agentes**: el AI Trust Framework (arriba) limita qué puede hacer un agente según autonomía.

### Lo que NO existe aún

- **Cifrado de datos en reposo gestionado por EditCore**: se depende enteramente del cifrado por defecto de Supabase/Postgres; no hay cifrado a nivel de aplicación para campos sensibles.
- **Rotación automática de API keys**: las developer keys no expiran ni rotan automáticamente.
- **Rate limiting propio**: no hay limitación de tasa de requests implementada en el código de EditCore (se depende de los límites de la plataforma Vercel).
- **Escaneo de vulnerabilidades / SAST automatizado en CI**: no configurado en este repositorio.
- **Auditoría de seguridad externa**: no realizada; esto es una autoevaluación basada en lectura de código.

Esta sección debe tratarse como una hoja de ruta de seguridad, no como una certificación.
