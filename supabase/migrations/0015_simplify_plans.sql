-- EditCore — simplifica la grilla de planes a free + pro (mensual/anual).
-- Antes: free, starter, professional, team, enterprise. Ahora: free, pro.
-- Postgres no permite borrar valores de un enum sin recrear el tipo, así que
-- los valores viejos (starter/professional/team/enterprise) quedan en el
-- enum pero ya no se usan ni se ofrecen — no rompe nada existente.

-- IMPORTANTE: correr este ALTER TYPE solo, confirmar, y recién después correr
-- el resto del archivo. Postgres no permite usar un valor de enum recién
-- agregado en la misma transacción en la que se agregó.
alter type editcore_plan add value if not exists 'pro';

-- ---- correr todo lo de abajo en una segunda ejecución ----

-- Migra cualquier organización/suscripción que ya tuviera un plan pago viejo a 'pro'.
update organizations set plan = 'pro' where plan in ('starter', 'professional', 'team', 'enterprise');
update subscriptions set plan = 'pro' where plan in ('starter', 'professional', 'team', 'enterprise');

-- Reemplaza la grilla de límites: solo free y pro.
delete from plan_limits where plan in ('starter', 'professional', 'team', 'enterprise');

insert into plan_limits (plan, monthly_token_limit, included_seats, storage_mb) values
  ('pro', 10000000, 10, 5000)
on conflict (plan) do update set
  monthly_token_limit = excluded.monthly_token_limit,
  included_seats = excluded.included_seats,
  storage_mb = excluded.storage_mb;

-- Frecuencia de facturación del plan pago (mensual $19, anual $182.40 = -20%).
alter table subscriptions
  add column if not exists billing_interval text check (billing_interval in ('monthly', 'annual'));
