# EditCore Billing System

Estado: **flujo de cobro implementado en código**. Falta únicamente la
configuración del lado del usuario en el dashboard de Stripe (productos,
precios y el webhook) — ningún secreto se guarda en este repositorio.

## 1. Lo que existe

- Tabla `subscriptions` en Supabase (`stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`).
- Tabla `plan_limits` con los planes (`free`, `starter`, `professional`, `team`, `enterprise`) y sus límites de tokens/asientos/almacenamiento.
- `GET /api/usage/summary` — calcula `overLimit` comparando `usage_events` del mes contra `plan_limits`.
- `POST /api/billing/checkout` (`api/billing/checkout.ts`) — crea una sesión de Stripe Checkout (`mode: subscription`) para la organización autenticada, reusando el `stripe_customer_id` si ya existe uno.
- `POST /api/billing/webhook` (`api/billing/webhook.ts`) — verifica la firma de Stripe (`STRIPE_WEBHOOK_SECRET`) y procesa `checkout.session.completed`, `customer.subscription.created/updated/deleted`, actualizando `subscriptions` y `organizations.plan`.
- `POST /api/usage/track` ahora **bloquea con HTTP 402** si la organización superó `monthly_token_limit` del plan actual — ya no es solo informativo.
- `lib/stripeClient.ts` — cliente de Stripe + mapeo plan↔Price ID vía variables de entorno.

## 2. Lo que falta (responsabilidad del usuario, no de código)

Estos pasos requieren acceso al dashboard de Stripe del usuario y **nunca se
hacen escribiendo claves en el repo**:

1. Crear los 4 productos/precios recurrentes en Stripe (Starter, Professional, Team, Enterprise).
2. Copiar cada Price ID al entorno de Vercel: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_ENTERPRISE`.
3. Configurar el endpoint de webhook en Stripe apuntando a `https://<dominio>/api/billing/webhook`, suscrito a `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copiar `STRIPE_SECRET_KEY` (modo test o live) y el `STRIPE_WEBHOOK_SECRET` que genera ese endpoint a las variables de entorno de Vercel.
5. Botón en la extensión/dashboard que llame a `POST /api/billing/checkout` y redirija a la `url` devuelta — todavía no construido en la UI (solo el backend).

Variables esperadas (nombres, sin valores) listadas en `.env.example`.
