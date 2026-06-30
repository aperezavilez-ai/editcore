-- Migration 0013: EditCore Autonomous Digital Enterprise
-- Tablas: dco_products, dco_leads, dco_proposals, dco_campaigns,
--         dco_support_tickets, dco_growth_initiatives, dco_business_units,
--         dco_governance_decisions, dco_executive_snapshots

-- Product Portfolio
CREATE TABLE IF NOT EXISTS dco_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'saas' CHECK (category IN ('saas','tool','api','marketplace','service','mvp','internal')),
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','mvp','beta','active','scaling','sunset')),
  stage text NOT NULL DEFAULT 'planning' CHECK (stage IN ('planning','building','launched','growing','mature')),
  mrr_usd_cents int NOT NULL DEFAULT 0,
  active_users int NOT NULL DEFAULT 0,
  nps_score int CHECK (nps_score BETWEEN -100 AND 100),
  roadmap jsonb NOT NULL DEFAULT '[]',
  priorities jsonb NOT NULL DEFAULT '[]',
  profitability text NOT NULL DEFAULT 'unknown' CHECK (profitability IN ('unknown','negative','break_even','positive','high')),
  owner_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_prod_all ON dco_products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sales Leads (AI Sales Engine)
CREATE TABLE IF NOT EXISTS dco_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'organic' CHECK (source IN ('organic','referral','cold','inbound','paid','event','partner')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal_sent','negotiating','won','lost','on_hold')),
  product_id uuid REFERENCES dco_products(id) ON DELETE SET NULL,
  estimated_value_usd_cents int NOT NULL DEFAULT 0,
  probability int NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  notes text,
  next_action text,
  next_action_date date,
  assigned_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_lead_all ON dco_leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sales Proposals
CREATE TABLE IF NOT EXISTS dco_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES dco_leads(id) ON DELETE SET NULL,
  product_id uuid REFERENCES dco_products(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  value_usd_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired')),
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_prop_all ON dco_proposals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Marketing Campaigns (AI Marketing Engine)
CREATE TABLE IF NOT EXISTS dco_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'content' CHECK (campaign_type IN ('content','email','social','paid','seo','event','partner','product_launch')),
  objective text NOT NULL,
  target_audience text NOT NULL,
  channels text[] NOT NULL DEFAULT '{}',
  content jsonb NOT NULL DEFAULT '[]',
  budget_usd_cents int NOT NULL DEFAULT 0,
  spent_usd_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','paused','completed','cancelled')),
  metrics jsonb NOT NULL DEFAULT '{}',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_camp_all ON dco_campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Support Tickets (AI Customer Support Center)
CREATE TABLE IF NOT EXISTS dco_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_email text,
  product_id uuid REFERENCES dco_products(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'question' CHECK (category IN ('question','bug','feature_request','billing','account','other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed','escalated')),
  resolution text,
  assigned_agent text,
  escalated_to_human boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_ticket_all ON dco_support_tickets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Growth Initiatives (Growth Engine AI)
CREATE TABLE IF NOT EXISTS dco_growth_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  initiative_type text NOT NULL DEFAULT 'acquisition' CHECK (initiative_type IN ('acquisition','retention','expansion','monetization','market_entry','partnership')),
  description text NOT NULL,
  target_metric text NOT NULL,
  target_value text NOT NULL,
  current_value text,
  market text,
  strategy text NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','active','paused','completed','cancelled')),
  estimated_impact text NOT NULL DEFAULT 'medium' CHECK (estimated_impact IN ('low','medium','high','transformational')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_growth_initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_growth_all ON dco_growth_initiatives FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Business Units (Business Builder Agent)
CREATE TABLE IF NOT EXISTS dco_business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  concept text NOT NULL,
  target_market text NOT NULL,
  business_model text NOT NULL,
  revenue_model text NOT NULL DEFAULT 'subscription' CHECK (revenue_model IN ('subscription','transactional','freemium','marketplace','licensing','services')),
  status text NOT NULL DEFAULT 'ideation' CHECK (status IN ('ideation','validation','building','launched','scaling','closed')),
  products jsonb NOT NULL DEFAULT '[]',
  team_agents jsonb NOT NULL DEFAULT '[]',
  financial_projection jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_business_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_biz_all ON dco_business_units FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Governance Decisions (AI Governance Board)
CREATE TABLE IF NOT EXISTS dco_governance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  decision_type text NOT NULL DEFAULT 'strategic' CHECK (decision_type IN ('strategic','security','ethics','risk','audit','compliance','investment','product')),
  description text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  recommendation text,
  decision text,
  rationale text,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  requires_human boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','decided','implemented','rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_governance_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_gov_all ON dco_governance_decisions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Executive Snapshots (CEO Intelligence Agent)
CREATE TABLE IF NOT EXISTS dco_executive_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text NOT NULL,
  opportunities jsonb NOT NULL DEFAULT '[]',
  risks jsonb NOT NULL DEFAULT '[]',
  recommendations jsonb NOT NULL DEFAULT '[]',
  kpis jsonb NOT NULL DEFAULT '{}',
  generated_by text NOT NULL DEFAULT 'ceo-intelligence-agent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dco_executive_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY dco_exec_all ON dco_executive_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
