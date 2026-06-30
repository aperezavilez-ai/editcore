-- Claves de API para desarrolladores externos que consumen la API pública
-- de EditCore (ver docs/EDITCORE_API_PLATFORM.md). Distinta de
-- organization_api_keys (que es para la extensión/IDE) y de la sesión de
-- Supabase Auth (correo/contraseña, usada en login.html/account.html).
--
-- Correr en el SQL Editor de Supabase (mismo proyecto que 0001-0003).

create table if not exists developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{"api:read"}',
  rate_limit_per_minute int not null default 60,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table developer_api_keys enable row level security;

create policy "users ven sus propias keys" on developer_api_keys
  for select using (auth.uid() = user_id);

create policy "users crean sus propias keys" on developer_api_keys
  for insert with check (auth.uid() = user_id);

create policy "users actualizan sus propias keys" on developer_api_keys
  for update using (auth.uid() = user_id);
