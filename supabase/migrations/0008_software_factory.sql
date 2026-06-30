-- EditCore Software Factory (Prompt 14). Pipeline completo de proyectos:
-- tracking de proyectos, tareas de sprint, releases y componentes
-- reutilizables. La "autonomía" de los agentes vive en los roles del IDE;
-- esta migración provee el estado persistente que necesitan para trabajar.
--
-- Correr en el SQL Editor de Supabase (mismo proyecto que 0001-0007).

-- Proyectos de la fábrica de software (distintos de architecture_projects,
-- que es el diseño; esto es el ciclo de vida de construcción completo).
create table if not exists factory_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'planning'
    check (status in ('planning', 'in_progress', 'testing', 'deploying', 'live', 'paused', 'archived')),
  tech_stack text[] not null default '{}',
  repo_url text,
  deploy_url text,
  current_version text not null default '0.1.0',
  product_requirements text,
  architecture_ref uuid references architecture_projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table factory_projects enable row level security;

create policy "usuarios ven sus proyectos factory" on factory_projects
  for select using (auth.uid() = user_id);

create policy "usuarios crean proyectos factory" on factory_projects
  for insert with check (auth.uid() = user_id);

create policy "usuarios actualizan sus proyectos factory" on factory_projects
  for update using (auth.uid() = user_id);

-- Tareas de sprint: cada proyecto tiene sus tareas con agente asignado,
-- estado y resultado (permite tracking real del avance de construcción).
create table if not exists factory_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references factory_projects(id) on delete cascade,
  title text not null,
  description text,
  agent text not null default 'fullstack'
    check (agent in ('product-manager', 'architect', 'fullstack', 'devops', 'qa', 'security', 'saas-builder', 'mobile', 'integrations', 'maintenance', 'release-manager', 'custom')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'blocked', 'review', 'done', 'cancelled')),
  priority int not null default 2 check (priority between 1 and 4),
  result text,
  requires_human_approval boolean not null default false,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table factory_tasks enable row level security;

create policy "usuarios ven tareas de sus proyectos" on factory_tasks
  for select using (
    exists (select 1 from factory_projects p where p.id = factory_tasks.project_id and p.user_id = auth.uid())
  );

create policy "usuarios crean tareas en sus proyectos" on factory_tasks
  for insert with check (
    exists (select 1 from factory_projects p where p.id = factory_tasks.project_id and p.user_id = auth.uid())
  );

create policy "usuarios actualizan tareas de sus proyectos" on factory_tasks
  for update using (
    exists (select 1 from factory_projects p where p.id = factory_tasks.project_id and p.user_id = auth.uid())
  );

-- Releases versionados: historial inmutable de cada versión publicada,
-- con notas de lanzamiento y posibilidad de restauración.
create table if not exists factory_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references factory_projects(id) on delete cascade,
  version text not null,
  channel text not null default 'production' check (channel in ('alpha', 'beta', 'production')),
  release_notes text,
  commit_sha text,
  deploy_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

alter table factory_releases enable row level security;

create policy "usuarios ven releases de sus proyectos" on factory_releases
  for select using (
    exists (select 1 from factory_projects p where p.id = factory_releases.project_id and p.user_id = auth.uid())
  );

create policy "usuarios crean releases en sus proyectos" on factory_releases
  for insert with check (
    exists (select 1 from factory_projects p where p.id = factory_releases.project_id and p.user_id = auth.uid())
  );

-- Biblioteca de componentes reutilizables: snippets, configs, templates
-- guardados durante la construcción de proyectos anteriores.
create table if not exists factory_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('auth', 'ui', 'api', 'db', 'ci', 'config', 'test', 'other')),
  language text,
  description text,
  code text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table factory_components enable row level security;

create policy "cualquiera ve componentes publicos" on factory_components
  for select using (is_public = true or auth.uid() = user_id);

create policy "usuarios guardan sus componentes" on factory_components
  for insert with check (auth.uid() = user_id);
