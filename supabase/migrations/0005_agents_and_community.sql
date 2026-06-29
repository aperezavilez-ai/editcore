-- Prerrequisitos reales para Agent Store y Community (ver
-- docs/EDITCORE_ECOSYSTEM_ARCHITECTURE.md): modela agentes como recursos
-- versionables de plataforma, y una capa social mínima (publicaciones y
-- comentarios) sobre la autenticación de usuario individual que ya existe.
--
-- Correr en el SQL Editor de Supabase (mismo proyecto que 0001-0004).

-- Agentes como recurso de plataforma (no como configuración interna fija
-- de la extensión). Cada agente le pertenece a un usuario y se puede
-- publicar (is_public) para que otros lo vean en /api/v1/agents.
create table if not exists agent_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  is_public boolean not null default false,
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agent_definitions enable row level security;

create policy "cualquiera ve agentes publicos" on agent_definitions
  for select using (is_public = true or auth.uid() = user_id);

create policy "users crean sus propios agentes" on agent_definitions
  for insert with check (auth.uid() = user_id);

create policy "users actualizan sus propios agentes" on agent_definitions
  for update using (auth.uid() = user_id);

create policy "users borran sus propios agentes" on agent_definitions
  for delete using (auth.uid() = user_id);

-- Versionado real: cada cambio de configuración crea una fila nueva en
-- vez de sobrescribir, permitiendo historial y rollback.
create table if not exists agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agent_definitions(id) on delete cascade,
  version_number int not null,
  config jsonb not null,
  changelog text,
  created_at timestamptz not null default now(),
  unique (agent_id, version_number)
);

alter table agent_versions enable row level security;

create policy "ver versiones de agentes visibles" on agent_versions
  for select using (
    exists (
      select 1 from agent_definitions a
      where a.id = agent_versions.agent_id
        and (a.is_public = true or a.user_id = auth.uid())
    )
  );

create policy "crear versiones de agentes propios" on agent_versions
  for insert with check (
    exists (
      select 1 from agent_definitions a
      where a.id = agent_versions.agent_id and a.user_id = auth.uid()
    )
  );

-- Comunidad básica: publicaciones y comentarios, ligados a la cuenta
-- individual de Supabase Auth que ya existe (login.html/account.html).
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table community_posts enable row level security;

create policy "cualquiera ve publicaciones" on community_posts
  for select using (true);

create policy "users crean sus propias publicaciones" on community_posts
  for insert with check (auth.uid() = user_id);

create policy "users borran sus propias publicaciones" on community_posts
  for delete using (auth.uid() = user_id);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table community_comments enable row level security;

create policy "cualquiera ve comentarios" on community_comments
  for select using (true);

create policy "users crean sus propios comentarios" on community_comments
  for insert with check (auth.uid() = user_id);

create policy "users borran sus propios comentarios" on community_comments
  for delete using (auth.uid() = user_id);
