-- ============================================================
-- 0011_enterprise_operating_model.sql
-- EditCore Enterprise Operating Model
-- ============================================================

-- Organigrama digital IA
create table if not exists public.biz_org_chart (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_title  text not null,
  agent_slug  text,
  department  text not null default 'general',
  level       int not null default 3 check (level between 1 and 5),
  parent_id   uuid references public.biz_org_chart(id) on delete set null,
  is_human    boolean not null default false,
  description text,
  created_at  timestamptz not null default now()
);
alter table public.biz_org_chart enable row level security;
create policy "owner_all_org" on public.biz_org_chart
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Procesos empresariales automatizables
create table if not exists public.biz_processes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  steps       jsonb not null default '[]',
  trigger_type text not null default 'manual'
                 check (trigger_type in ('manual','scheduled','event','webhook')),
  status      text not null default 'draft'
                check (status in ('draft','active','paused','archived')),
  owner_agent text,
  run_count   int not null default 0,
  last_run_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.biz_processes enable row level security;
create policy "owner_all_proc" on public.biz_processes
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- OKRs (Objetivos y Resultados Clave)
create table if not exists public.biz_okrs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.factory_projects(id) on delete set null,
  objective   text not null,
  key_results jsonb not null default '[]',
  period      text not null,
  owner_agent text,
  progress    int not null default 0 check (progress between 0 and 100),
  status      text not null default 'active'
                check (status in ('active','completed','cancelled','at_risk')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.biz_okrs enable row level security;
create policy "owner_all_okrs" on public.biz_okrs
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Clientes empresariales
create table if not exists public.biz_customers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  company         text,
  email           text,
  contract_value  int not null default 0,
  contract_start  date,
  contract_end    date,
  status          text not null default 'active'
                    check (status in ('prospect','active','paused','churned')),
  assigned_agent  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.biz_customers enable row level security;
create policy "owner_all_cust" on public.biz_customers
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reuniones inteligentes
create table if not exists public.biz_meetings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  project_id   uuid references public.factory_projects(id) on delete set null,
  customer_id  uuid references public.biz_customers(id) on delete set null,
  title        text not null,
  agenda       jsonb not null default '[]',
  attendees    jsonb not null default '[]',
  decisions    jsonb not null default '[]',
  action_items jsonb not null default '[]',
  summary      text,
  held_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
alter table public.biz_meetings enable row level security;
create policy "owner_all_meet" on public.biz_meetings
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Knowledge hub empresarial
create table if not exists public.biz_knowledge_docs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  category    text not null default 'process'
                check (category in ('process','manual','decision','experience','policy','template')),
  content     text not null,
  tags        text[] not null default '{}',
  owner_agent text,
  version     int not null default 1,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.biz_knowledge_docs enable row level security;
create policy "public_read_kd" on public.biz_knowledge_docs
  for select using (is_public = true or user_id = auth.uid());
create policy "owner_write_kd" on public.biz_knowledge_docs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registros financieros
create table if not exists public.biz_finance_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  project_id      uuid references public.factory_projects(id) on delete set null,
  period          text not null,
  category        text not null default 'other'
                    check (category in ('infrastructure','ai_usage','development','revenue','marketing','operations','other')),
  amount_usd_cents int not null default 0,
  description     text not null,
  is_revenue      boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table public.biz_finance_records enable row level security;
create policy "owner_all_fin" on public.biz_finance_records
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reportes ejecutivos
create table if not exists public.biz_reports (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  report_type         text not null default 'daily'
                        check (report_type in ('daily','weekly','monthly','strategic')),
  period              text not null,
  summary             text,
  content             jsonb not null default '{}',
  generated_by_agent  text,
  created_at          timestamptz not null default now()
);
alter table public.biz_reports enable row level security;
create policy "owner_all_rep" on public.biz_reports
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Indices
create index if not exists idx_biz_org_parent on public.biz_org_chart(parent_id);
create index if not exists idx_biz_org_user on public.biz_org_chart(user_id);
create index if not exists idx_biz_proc_user on public.biz_processes(user_id);
create index if not exists idx_biz_okrs_user on public.biz_okrs(user_id);
create index if not exists idx_biz_cust_user on public.biz_customers(user_id);
create index if not exists idx_biz_meet_user on public.biz_meetings(user_id);
create index if not exists idx_biz_fin_user on public.biz_finance_records(user_id);
create index if not exists idx_biz_fin_period on public.biz_finance_records(period);
create index if not exists idx_biz_reports_type on public.biz_reports(report_type);
create index if not exists idx_biz_knowledge_tags on public.biz_knowledge_docs using gin(tags);
