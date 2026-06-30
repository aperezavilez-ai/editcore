-- ============================================================
-- 0010_agent_network.sql
-- EditCore Global Agent Network
-- ============================================================

-- Equipos virtuales de agentes IA
create table if not exists public.agent_teams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.factory_projects(id) on delete set null,
  name        text not null,
  team_type   text not null default 'development'
                check (team_type in ('development','business','research','quality','enterprise')),
  description text,
  members     jsonb not null default '[]',
  status      text not null default 'active' check (status in ('active','paused','disbanded')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.agent_teams enable row level security;
create policy "owner_all_teams" on public.agent_teams
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Protocolo de comunicacion entre agentes
create table if not exists public.agent_messages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  thread_id      uuid not null default gen_random_uuid(),
  sender_agent   text not null,
  receiver_agent text,
  team_id        uuid references public.agent_teams(id) on delete set null,
  msg_type       text not null default 'request'
                   check (msg_type in ('request','response','transfer','validate','broadcast','escalate')),
  subject        text,
  content        jsonb not null default '{}',
  parent_id      uuid references public.agent_messages(id) on delete set null,
  status         text not null default 'sent' check (status in ('sent','received','processed','failed')),
  created_at     timestamptz not null default now()
);
alter table public.agent_messages enable row level security;
create policy "owner_all_msgs" on public.agent_messages
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nodos del grafo de conocimiento global
create table if not exists public.knowledge_nodes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  node_type   text not null check (node_type in ('project','solution','component','pattern','experience','technology','research')),
  title       text not null,
  summary     text,
  content     jsonb not null default '{}',
  tags        text[] not null default '{}',
  is_public   boolean not null default false,
  source_agent text,
  confidence  int not null default 80 check (confidence between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.knowledge_nodes enable row level security;
create policy "public_read_kn" on public.knowledge_nodes
  for select using (is_public = true or user_id = auth.uid());
create policy "owner_write_kn" on public.knowledge_nodes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Aristas del grafo de conocimiento
create table if not exists public.knowledge_edges (
  id            uuid primary key default gen_random_uuid(),
  from_node_id  uuid not null references public.knowledge_nodes(id) on delete cascade,
  to_node_id    uuid not null references public.knowledge_nodes(id) on delete cascade,
  relation_type text not null check (relation_type in ('uses','implements','extends','references','learned_from','improves','replaces','depends_on')),
  weight        int not null default 50 check (weight between 0 and 100),
  created_at    timestamptz not null default now(),
  unique (from_node_id, to_node_id, relation_type)
);
alter table public.knowledge_edges enable row level security;
create policy "public_read_ke" on public.knowledge_edges for select using (true);
create policy "auth_write_ke" on public.knowledge_edges
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Reportes de investigacion autonoma
create table if not exists public.research_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  team_id      uuid references public.agent_teams(id) on delete set null,
  title        text not null,
  topic        text not null,
  findings     text not null,
  sources      jsonb not null default '[]',
  tags         text[] not null default '{}',
  quality_score int not null default 70 check (quality_score between 0 and 100),
  created_by_agent text,
  created_at   timestamptz not null default now()
);
alter table public.research_reports enable row level security;
create policy "auth_read_rr" on public.research_reports
  for select using (auth.uid() is not null);
create policy "owner_write_rr" on public.research_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Revisiones de calidad global
create table if not exists public.quality_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  project_id   uuid references public.factory_projects(id) on delete set null,
  task_id      uuid references public.factory_tasks(id) on delete set null,
  reviewer_agent text not null,
  dimensions   jsonb not null default '{}',
  overall_score int not null default 0 check (overall_score between 0 and 100),
  issues       jsonb not null default '[]',
  approved     boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now()
);
alter table public.quality_reviews enable row level security;
create policy "owner_all_qr" on public.quality_reviews
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Decisiones del supervisor maestro
create table if not exists public.supervisor_decisions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  team_id         uuid references public.agent_teams(id) on delete set null,
  goal            text not null,
  decision_type   text not null check (decision_type in ('routing','conflict','optimization','escalation')),
  context         jsonb not null default '{}',
  decision        jsonb not null default '{}',
  rationale       text,
  outcome         text,
  created_at      timestamptz not null default now()
);
alter table public.supervisor_decisions enable row level security;
create policy "owner_all_sd" on public.supervisor_decisions
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Indices
create index if not exists idx_agent_msgs_thread on public.agent_messages(thread_id);
create index if not exists idx_agent_msgs_user on public.agent_messages(user_id);
create index if not exists idx_knowledge_nodes_type on public.knowledge_nodes(node_type);
create index if not exists idx_knowledge_nodes_tags on public.knowledge_nodes using gin(tags);
create index if not exists idx_teams_user on public.agent_teams(user_id);
create index if not exists idx_quality_reviews_project on public.quality_reviews(project_id);
