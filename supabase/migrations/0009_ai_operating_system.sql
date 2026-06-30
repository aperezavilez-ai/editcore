-- ============================================================
-- 0009_ai_operating_system.sql
-- EditCore AI Operating System — tablas centrales del cerebro IA
-- ============================================================

-- -------------------------------------------------------
-- ai_orchestration_runs: cada vez que el orquestador procesa un objetivo
-- -------------------------------------------------------
create table if not exists public.ai_orchestration_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.factory_projects(id) on delete set null,
  goal          text not null,
  status        text not null default 'planning'
                  check (status in ('planning','running','paused','completed','failed')),
  autonomy_level int not null default 1 check (autonomy_level between 1 and 5),
  agent_sequence jsonb not null default '[]',
  current_step  int not null default 0,
  result        text,
  error_detail  text,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.ai_orchestration_runs enable row level security;
create policy "owner_all" on public.ai_orchestration_runs
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------------------
-- ai_task_plans: descomposición de objetivos complejos
-- -------------------------------------------------------
create table if not exists public.ai_task_plans (
  id                   uuid primary key default gen_random_uuid(),
  orchestration_run_id uuid references public.ai_orchestration_runs(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  goal                 text not null,
  strategy             text,
  subtasks             jsonb not null default '[]',
  priority_order       jsonb not null default '[]',
  status               text not null default 'pending'
                         check (status in ('pending','in_progress','completed','failed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.ai_task_plans enable row level security;
create policy "owner_all" on public.ai_task_plans
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------------------
-- ai_model_usage: log de uso de modelos IA con costo y latencia
-- -------------------------------------------------------
create table if not exists public.ai_model_usage (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  project_id      uuid references public.factory_projects(id) on delete set null,
  model_id        text not null,
  task_type       text not null,
  tokens_input    int not null default 0,
  tokens_output   int not null default 0,
  cost_usd_cents  int not null default 0,
  latency_ms      int,
  success         boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.ai_model_usage enable row level security;
create policy "owner_read" on public.ai_model_usage
  for select using (user_id = auth.uid());
create policy "service_insert" on public.ai_model_usage
  for insert with check (true);

-- -------------------------------------------------------
-- ai_agent_activations: estado de cada agente por usuario/proyecto
-- -------------------------------------------------------
create table if not exists public.ai_agent_activations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  project_id      uuid references public.factory_projects(id) on delete set null,
  agent_slug      text not null,
  status          text not null default 'idle'
                    check (status in ('idle','active','paused','terminated')),
  session_context jsonb not null default '{}',
  last_active_at  timestamptz default now(),
  created_at      timestamptz not null default now()
);

alter table public.ai_agent_activations enable row level security;
create policy "owner_all" on public.ai_agent_activations
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------------------
-- ai_governance_rules: permisos y límites para agentes
-- -------------------------------------------------------
create table if not exists public.ai_governance_rules (
  id                uuid primary key default gen_random_uuid(),
  scope             text not null default 'global'
                      check (scope in ('global','project','user')),
  agent_slug        text,
  action_type       text not null,
  allowed           boolean not null default true,
  requires_approval boolean not null default false,
  min_autonomy_level int not null default 1,
  description       text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table public.ai_governance_rules enable row level security;
create policy "authenticated_read" on public.ai_governance_rules
  for select using (auth.uid() is not null);
create policy "owner_write" on public.ai_governance_rules
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- Reglas base del sistema
insert into public.ai_governance_rules (scope, action_type, allowed, requires_approval, min_autonomy_level, description) values
  ('global', 'read_files',     true,  false, 1, 'Lectura de archivos siempre permitida'),
  ('global', 'write_files',    true,  true,  3, 'Escritura requiere aprobación en nivel < 4'),
  ('global', 'git_commit',     true,  true,  4, 'Commits requieren aprobación humana'),
  ('global', 'deploy',         true,  true,  4, 'Deploy siempre requiere aprobación'),
  ('global', 'delete_data',    false, true,  5, 'Eliminar datos está prohibido en autonomía < 5'),
  ('global', 'modify_secrets', false, false, 5, 'Modificar secrets NUNCA permitido autónomamente'),
  ('global', 'api_call',       true,  false, 2, 'Llamadas API externas permitidas desde nivel 2'),
  ('global', 'create_agent',   true,  true,  3, 'Crear agentes requiere aprobación');

-- -------------------------------------------------------
-- ai_meta_learning: lecciones aprendidas de resultados anteriores
-- -------------------------------------------------------
create table if not exists public.ai_meta_learning (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null check (event_type in ('success','failure','correction','insight')),
  context     jsonb not null default '{}',
  outcome     text,
  lesson      text not null,
  applies_to  text,
  confidence  int not null default 50 check (confidence between 0 and 100),
  created_at  timestamptz not null default now()
);

alter table public.ai_meta_learning enable row level security;
create policy "authenticated_read" on public.ai_meta_learning
  for select using (auth.uid() is not null);
create policy "service_insert" on public.ai_meta_learning
  for insert with check (true);

-- -------------------------------------------------------
-- ai_knowledge_snapshots: estado global del conocimiento de la plataforma
-- -------------------------------------------------------
create table if not exists public.ai_knowledge_snapshots (
  id          uuid primary key default gen_random_uuid(),
  snapshot    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.ai_knowledge_snapshots enable row level security;
create policy "authenticated_read" on public.ai_knowledge_snapshots
  for select using (auth.uid() is not null);
create policy "service_insert" on public.ai_knowledge_snapshots
  for insert with check (true);

-- Índices para rendimiento
create index if not exists idx_orch_runs_user on public.ai_orchestration_runs(user_id);
create index if not exists idx_orch_runs_project on public.ai_orchestration_runs(project_id);
create index if not exists idx_model_usage_user on public.ai_model_usage(user_id);
create index if not exists idx_model_usage_created on public.ai_model_usage(created_at desc);
create index if not exists idx_agent_activations_user on public.ai_agent_activations(user_id);
create index if not exists idx_meta_learning_type on public.ai_meta_learning(event_type);
