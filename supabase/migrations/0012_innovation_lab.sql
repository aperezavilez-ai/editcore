-- Migration 0012: EditCore Autonomous Innovation Lab
-- Tablas: lab_ideas, lab_experiments, lab_prototypes, lab_research_reports,
--         lab_trend_signals, lab_startups, lab_competitive_intel, lab_innovation_memory

-- Ideas (Idea Generation Engine + Validation)
CREATE TABLE IF NOT EXISTS lab_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  problem text NOT NULL,
  solution text NOT NULL,
  market text NOT NULL,
  complexity text NOT NULL DEFAULT 'medium' CHECK (complexity IN ('low','medium','high','very_high')),
  potential text NOT NULL DEFAULT 'medium' CHECK (potential IN ('low','medium','high','very_high')),
  category text NOT NULL DEFAULT 'feature' CHECK (category IN ('product','feature','tool','service','startup','experiment')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validating','validated','rejected','building','launched')),
  validation_scores jsonb NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  generated_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_ideas_all ON lab_ideas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Experiments (Experiment Management System)
CREATE TABLE IF NOT EXISTS lab_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id uuid REFERENCES lab_ideas(id) ON DELETE SET NULL,
  title text NOT NULL,
  hypothesis text NOT NULL,
  method text NOT NULL,
  success_criteria text NOT NULL,
  results text,
  learnings text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_exp_all ON lab_experiments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Prototypes (Prototype Lab)
CREATE TABLE IF NOT EXISTS lab_prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id uuid REFERENCES lab_ideas(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL,
  proto_type text NOT NULL DEFAULT 'mvp' CHECK (proto_type IN ('mvp','poc','demo','experiment','wireframe')),
  stack jsonb NOT NULL DEFAULT '[]',
  architecture text,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','building','testing','done','archived')),
  demo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_prototypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_proto_all ON lab_prototypes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Research Reports (Global Research Agent)
CREATE TABLE IF NOT EXISTS lab_research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'technology' CHECK (report_type IN ('technology','market','competitor','trend','opportunity','ai_models')),
  content text NOT NULL,
  summary text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]',
  tags text[] NOT NULL DEFAULT '{}',
  generated_by text NOT NULL DEFAULT 'research-agent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_research_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_research_all ON lab_research_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trend Signals (Trend Intelligence System)
CREATE TABLE IF NOT EXISTS lab_trend_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_name text NOT NULL,
  category text NOT NULL DEFAULT 'technology' CHECK (category IN ('technology','market','business_model','regulation','consumer','ai')),
  description text NOT NULL,
  strength text NOT NULL DEFAULT 'emerging' CHECK (strength IN ('emerging','growing','mainstream','declining')),
  opportunity_score int NOT NULL DEFAULT 50 CHECK (opportunity_score BETWEEN 0 AND 100),
  sectors text[] NOT NULL DEFAULT '{}',
  related_ideas jsonb NOT NULL DEFAULT '[]',
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_trend_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_trend_all ON lab_trend_signals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Startups (Startup Builder Agent)
CREATE TABLE IF NOT EXISTS lab_startups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id uuid REFERENCES lab_ideas(id) ON DELETE SET NULL,
  name text NOT NULL,
  tagline text NOT NULL,
  concept text NOT NULL,
  target_market text NOT NULL,
  business_model text NOT NULL,
  revenue_streams jsonb NOT NULL DEFAULT '[]',
  architecture jsonb NOT NULL DEFAULT '{}',
  mvp_plan jsonb NOT NULL DEFAULT '[]',
  simulation jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'concept' CHECK (status IN ('concept','validating','building','launched','pivoted','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_startups ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_startup_all ON lab_startups FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Competitive Intelligence
CREATE TABLE IF NOT EXISTS lab_competitive_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_name text NOT NULL,
  category text NOT NULL DEFAULT 'direct' CHECK (category IN ('direct','indirect','emerging','adjacent')),
  strengths jsonb NOT NULL DEFAULT '[]',
  weaknesses jsonb NOT NULL DEFAULT '[]',
  features jsonb NOT NULL DEFAULT '[]',
  differentiators text,
  threat_level text NOT NULL DEFAULT 'medium' CHECK (threat_level IN ('low','medium','high','critical')),
  recommendations jsonb NOT NULL DEFAULT '[]',
  last_analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_competitive_intel ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_comp_all ON lab_competitive_intel FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Innovation Memory (System of Learnings)
CREATE TABLE IF NOT EXISTS lab_innovation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL DEFAULT 'learning' CHECK (memory_type IN ('learning','pattern','decision','success','failure','insight')),
  title text NOT NULL,
  content text NOT NULL,
  source_type text,
  source_id uuid,
  impact text NOT NULL DEFAULT 'medium' CHECK (impact IN ('low','medium','high','critical')),
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lab_innovation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_memory_all ON lab_innovation_memory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
