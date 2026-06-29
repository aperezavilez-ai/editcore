-- EditCore Self Evolution (Prompt 12). Almacena auditorías reales del
-- estado del sistema y propuestas de mejora con niveles de aprobación.
-- No autoejecuta cambios de código: niveles 4-5 requieren acción humana
-- (ver docs/EDITCORE_EVOLUTION_WORKFLOW.md), por diseño de seguridad.
--
-- Correr en el SQL Editor de Supabase (mismo proyecto que 0001-0005).

create table if not exists evolution_audits (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'weekly', 'monthly')),
  metrics jsonb not null,
  created_at timestamptz not null default now()
);

alter table evolution_audits enable row level security;

create policy "service role administra auditorias" on evolution_audits
  for all using (auth.role() = 'service_role');

-- Niveles de aprobación (Fase 11 del prompt):
-- 1 analizar, 2 proponer, 3 prototipo, 4 implementar con aprobación,
-- 5 optimización automática limitada (reservado, no usado todavía).
create table if not exists evolution_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  source text not null default 'manual' check (source in ('manual', 'audit', 'community')),
  level int not null default 1 check (level between 1 and 5),
  status text not null default 'proposed' check (status in ('proposed', 'in_review', 'approved', 'rejected', 'implemented')),
  impact text,
  complexity text,
  outcome text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table evolution_proposals enable row level security;

create policy "cualquiera ve propuestas" on evolution_proposals
  for select using (true);

create policy "users autenticados crean propuestas" on evolution_proposals
  for insert with check (auth.uid() = created_by);
