-- Biblioteca de arquitecturas empresariales (Prompt 13, Fase 12).
-- Guarda patrones exitosos, soluciones SaaS y mejores prácticas que los
-- agentes Enterprise Architect pueden consultar y al que los usuarios
-- pueden contribuir.
--
-- Correr en el SQL Editor de Supabase (mismo proyecto que 0001-0006).

create table if not exists architecture_patterns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('saas', 'enterprise', 'api', 'ai', 'data', 'security', 'devops', 'other')),
  description text not null,
  tech_stack text[] not null default '{}',
  content text not null,
  is_official boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table architecture_patterns enable row level security;

create policy "cualquiera ve patrones" on architecture_patterns
  for select using (true);

create policy "usuarios autenticados contribuyen patrones" on architecture_patterns
  for insert with check (auth.uid() = user_id);

-- Proyectos de arquitectura generados por el agente enterprise-architect.
-- Permite guardar el output de una sesión de diseño para referencia futura.
create table if not exists architecture_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  business_requirements text,
  solution_architecture text,
  ai_architecture text,
  implementation_roadmap text,
  cost_estimate text,
  risk_report text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table architecture_projects enable row level security;

create policy "usuarios ven sus propios proyectos" on architecture_projects
  for select using (auth.uid() = user_id);

create policy "usuarios crean sus propios proyectos" on architecture_projects
  for insert with check (auth.uid() = user_id);

create policy "usuarios actualizan sus propios proyectos" on architecture_projects
  for update using (auth.uid() = user_id);
