# EditCore Business Operations

Estado: **no implementado**. No existe ninguna automatización de operaciones
de negocio (alta de clientes, reportes financieros, métricas de crecimiento,
etc.) más allá de lo que ya está cubierto por el backend real descrito en
`EDITCORE_SAAS_ARCHITECTURE.md`.

## 1. Lo que sí existe

- Datos reales en Supabase que podrían alimentar reportes de negocio en el futuro: `organizations`, `usage_events`, `plan_limits` — pero sin ninguna capa de reporting construida sobre ellos.
- Acceso directo a Supabase (SQL/dashboard) para consultas manuales — esto es, hoy, el único "reporte" disponible: alguien con acceso a Supabase ejecuta SQL a mano.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Alta de organizaciones automatizada**: hoy se crea una organización y su clave de API insertando filas manualmente en Supabase vía SQL (ver `EDITCORE_SAAS_ARCHITECTURE.md` §5). No hay formulario de registro, ni flujo de "signup" público.
- **Panel de administración interno**: no existe ninguna interfaz para que el equipo de EditCore vea todas las organizaciones, su plan, su consumo agregado, o ingresos.
- **Reportes financieros / MRR / churn**: no hay ningún cálculo de métricas de negocio (ingreso mensual recurrente, tasa de cancelación, LTV) porque no hay cobro real todavía (ver `EDITCORE_BILLING_SYSTEM.md`).
- **Alertas operativas**: no hay monitoreo automático de errores del backend, ni alertas si Supabase o Vercel tienen problemas, más allá de los dashboards nativos de esas plataformas.
- **Automatización de procesos internos** (ej. emails de bienvenida, recordatorios de renovación, scripts de rotación de claves): nada de esto existe; todo sería manual hoy.

## 3. Próximos pasos sugeridos (no implementados)

1. Endpoint interno `/api/admin/organizations` (protegido con una clave de administrador distinta a las de organización) para crear/listar organizaciones sin SQL manual.
2. Vista de Supabase o tabla materializada para métricas agregadas de consumo por plan.
3. Una vez exista cobro real (Stripe), calcular MRR y churn a partir de la tabla `subscriptions`.
4. Integración con un proveedor de email transaccional para automatizar notificaciones operativas básicas.

Hoy, toda operación de negocio de EditCore (crear una organización, revisar
consumo, lo que sea) se hace manualmente vía SQL directo en Supabase. No hay
ninguna automatización real.
