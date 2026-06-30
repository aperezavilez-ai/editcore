# EditCore Billing System

Estado: **flujo de cobro implementado en código**. Falta únicamente la
configuración del lado del usuario en el dashboard de Stripe (productos,
precios y el webhook) — ningún secreto se guarda en este repositorio.

## 1. Estructura de planes

Solo dos planes: **free** y **pro**. El plan `pro` tiene dos frecuencias de
facturación:

| Frecuencia | Precio |
|---|---|
| Mensual | $19/mes |
| Anual | $182.40/año (equivale a $15.20/mes, -20%) |

Precio fijado por benchmark de competencia (junio 2026): GitHub Copilot Pro
$10/mes, Windsurf Pro $20/mes, Cursor Pro $20/mes (~$16/mes facturado anual,
20% off). $19/mes posiciona a EditCore en ese mismo rango. Pendiente de
validar contra costo real de IA por usuario en `usage_events` apenas haya
organizaciones con uso activo.

Los tiers viejos (`starter`, `professional`, `team`, `enterprise`) quedan
dados de baja — ver migración `0015_simplify_plans.sql`.

## 2. Lo que existe

- Tabla `subscriptions` en Supabase (`stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `billing_interval`, `current_period_end`).
- Tabla `plan_limits` con dos filas: `free` y `pro` (10,000,000 tokens/mes, 10 asientos, 5,000 MB).
- `GET /api/usage/summary` — calcula `overLimit` comparando `usage_events` del mes contra `plan_limits`.
- `POST /api/billing/checkout` (`api/billing/checkout.ts`) — recibe `{ interval: "monthly" | "annual", successUrl, cancelUrl }`, crea una sesión de Stripe Checkout (`mode: subscription`) para la organización autenticada, reusando `stripe_customer_id` si ya existe uno.
- `POST /api/billing/webhook` (`api/billing/webhook.ts`) — verifica la firma de Stripe (`STRIPE_WEBHOOK_SECRET`) y procesa `checkout.session.completed`, `customer.subscription.created/updated/deleted`, actualizando `subscriptions` (incluido `billing_interval`) y `organizations.plan`.
- `POST /api/usage/track` **bloquea con HTTP 402** si la organización superó `monthly_token_limit` del plan actual.
- `lib/stripeClient.ts` — cliente de Stripe + mapeo frecuencia↔Price ID vía variables de entorno.

## 3. Lo que falta (responsabilidad del usuario, no de código)

Estos pasos requieren acceso al dashboard de Stripe del usuario y **nunca se
hacen escribiendo claves en el repo**:

1. Crear un producto "EditCore Pro" en Stripe con **dos precios recurrentes**: uno mensual ($19) y uno anual ($182.40).
2. Copiar cada Price ID al entorno de Vercel: `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`.
3. Configurar el endpoint de webhook en Stripe apuntando a `https://<dominio>/api/billing/webhook`, suscrito a `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copiar `STRIPE_SECRET_KEY` (modo test o live) y el `STRIPE_WEBHOOK_SECRET` que genera ese endpoint a las variables de entorno de Vercel.
5. Correr `supabase/migrations/0015_simplify_plans.sql` en el SQL Editor de Supabase (en dos pasos, según las instrucciones del propio archivo).
6. Botón en la extensión/dashboard que llame a `POST /api/billing/checkout` y redirija a la `url` devuelta — todavía no construido en la UI (solo el backend).

Variables esperadas (nombres, sin valores) listadas en `.env.example`.
