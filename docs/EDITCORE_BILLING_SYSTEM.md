# EditCore Billing System

Estado: **no implementado todavía**. Este documento es honesto sobre lo que
existe (el modelo de datos) y lo que falta (todo el flujo de cobro real).

## 1. Lo que sí existe

- Tabla `subscriptions` en Supabase (`stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`) — lista para recibir datos de Stripe, pero **vacía**, nada la llena hoy.
- Tabla `plan_limits` con los 5 planes (`free`, `pro`, `team`, `business`, `enterprise`) y sus límites de tokens/asientos/almacenamiento, precargada con valores reales en la migración inicial.
- Endpoint `/api/usage/summary` que ya calcula si una organización superó su límite mensual de tokens (`overLimit: true/false`), comparando `usage_events` contra `plan_limits`.
- `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` están declaradas como variables de entorno esperadas (`.env.example`), pero no se usan en ningún código todavía — son placeholders para cuando se implemente.

## 2. Lo que falta (todo el sistema de cobro)

- No hay integración con el SDK de Stripe en el backend (la dependencia `stripe` está en `package.json` pero no se importa en ningún archivo).
- No hay endpoint de Stripe Checkout para iniciar un pago.
- No hay webhook (`/api/stripe/webhook`) para recibir eventos de Stripe (pago exitoso, cancelación, etc.) y actualizar `subscriptions`.
- No hay lógica de upgrade/downgrade de plan.
- No hay enforcement real: aunque `/api/usage/summary` calcula `overLimit`, **ningún endpoint bloquea el uso** cuando se supera el límite. Es solo informativo hoy.
- No hay facturación, recibos, ni período de prueba.

## 3. Plan honesto para implementarlo (no construido aún)

1. Crear productos/precios en el dashboard de Stripe para cada plan.
2. Endpoint `/api/billing/checkout` que cree una sesión de Stripe Checkout para la organización autenticada.
3. Endpoint `/api/billing/webhook` que verifique la firma de Stripe y actualice `subscriptions.plan` / `status` según el evento.
4. Modificar `/api/usage/track` para rechazar (HTTP 402) nuevos eventos si `overLimit` es verdadero y el plan no permite excederse.
5. Botón en la extensión ("Actualizar plan") que abra la URL de Checkout en el navegador.

Ninguno de estos 5 pasos está implementado — se documentan aquí como la ruta
real a seguir, sin fingir que ya existen.
