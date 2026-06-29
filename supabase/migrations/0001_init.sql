-- EditCore backend — esquema inicial real (Fases 2, 3, 4 del Prompt 10).
-- Correr en el SQL Editor del proyecto Supabase "editcore"
-- (https://xhoxplbeggvtxdujcxqn.supabase.co) o vía `supabase db push` con la CLI.

create extension if not exists "pgcrypto";

create type editcore_plan as enum ('free', 'starter', 'professional', 'team', 'enterprise');

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan editcore_plan not null default 'free',
  created_at timestamptz not null default now()
);

-- Perfil de usuario de EditCore. auth.users ya existe si se usa Supabase Auth;
-- esta tabla guarda los datos propios de EditCore vinculados 1:1 con ese usuario.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references organizations (id) on delete set null,
  full_name text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan editcore_plan not null default 'free',
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un evento de consumo de IA por request real (token in/out, costo, modelo, tool).
-- Esto es lo que la extensión reportaría al backend si el usuario activa
-- sincronización de consumo (opt-in); no reemplaza el tracking local de
-- apiKeyService.ts, lo complementa para organizaciones con varios usuarios.
create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  project_label text,
  provider text not null check (provider in ('claude', 'openai', 'openrouter')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  tool_name text,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_org_created_idx on usage_events (organization_id, created_at desc);
create index if not exists subscriptions_org_idx on subscriptions (organization_id);

-- Límites por plan (Fase 3/4): tokens/mes incluidos, antes de cobrar overage o bloquear.
create table if not exists plan_limits (
  plan editcore_plan primary key,
  monthly_token_limit bigint not null,
  included_seats integer not null,
  storage_mb integer not null
);

insert into plan_limits (plan, monthly_token_limit, included_seats, storage_mb) values
  ('free', 200000, 1, 50),
  ('starter', 2000000, 3, 500),
  ('professional', 10000000, 10, 5000),
  ('team', 50000000, 25, 20000),
  ('enterprise', 500000000, 200, 200000)
on conflict (plan) do nothing;

-- Key de servicio por organización: la extensión EditCore la usa para autenticar
-- llamadas server-to-server (reportar consumo, leer plan/límites). No es OAuth de
-- usuario final — es una key opaca emitida por organización, igual de simple que
-- la API key de Anthropic que ya maneja la extensión, pero para hablar con este
-- backend. Se guarda hasheada (sha256), nunca en texto plano.
create table if not exists organization_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  key_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists organization_api_keys_hash_idx on organization_api_keys (key_hash);

-- Row Level Security: cada organización solo ve sus propios datos.
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table usage_events enable row level security;

create policy "org members can read their organization"
  on organizations for select
  using (id in (select organization_id from profiles where profiles.id = auth.uid()));

create policy "users can read their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "org members can read their subscription"
  on subscriptions for select
  using (organization_id in (select organization_id from profiles where profiles.id = auth.uid()));

create policy "org members can read their usage events"
  on usage_events for select
  using (organization_id in (select organization_id from profiles where profiles.id = auth.uid()));

-- plan_limits es de solo lectura pública (no expone datos de ninguna organización).
alter table plan_limits enable row level security;
create policy "plan limits are readable by anyone authenticated"
  on plan_limits for select
  using (true);
