-- ============================================================
-- 023_lead_ingestion.sql — Lead ingestion (external lead sources)
--
-- `lead_sources` — one row per external feed (IndiaMART, JustDial,
-- Google Ads lead forms, Meta leadgen, or a generic signed webhook).
-- Each source owns a secret `webhook_key` that becomes the public
-- ingest path: POST /api/leads/ingest/<webhook_key>.
--
-- `leads` — one row per ingested payload: the normalized fields, a
-- link to the upserted contact, the raw provider payload for audit,
-- and a dedupe/status trail.
--
-- Idempotent migration — safe to run multiple times.
-- Follows the conventions of 006_automations.sql and 017_account_sharing.sql:
--   IF NOT EXISTS on tables/indexes, DROP IF EXISTS before
--   re-creating policies/triggers (Postgres has no
--   CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- LEAD_SOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('indiamart', 'justdial', 'google_ads', 'meta', 'webhook')
  ),
  -- Secret path token for POST /api/leads/ingest/<webhook_key>.
  -- Generated with crypto.randomBytes(32).base64url; shown once at
  -- creation. Never exposed by the list/detail API.
  webhook_key TEXT NOT NULL,
  -- Optional shared secret for HMAC-SHA256 verification of the
  -- generic `webhook` provider (`X-Signature: sha256=<hex>`).
  -- Stored encrypted at rest, same as webhook_endpoints.secret.
  verify_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Speed-to-lead wiring: where the deal lands and what fires back.
  default_pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  default_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  auto_reply_template_name TEXT,
  assign_to_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Maps normalized lead fields to provider payload keys, e.g.
  -- '{"phone": "customer_mobile", "name": "buyer_name"}'.
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_sources_webhook_key
  ON lead_sources(webhook_key);
CREATE INDEX IF NOT EXISTS idx_lead_sources_account
  ON lead_sources(account_id);

ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_sources_select ON lead_sources;
CREATE POLICY lead_sources_select ON lead_sources FOR SELECT
  USING (is_account_member(account_id));
DROP POLICY IF EXISTS lead_sources_insert ON lead_sources;
CREATE POLICY lead_sources_insert ON lead_sources FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS lead_sources_update ON lead_sources;
CREATE POLICY lead_sources_update ON lead_sources FOR UPDATE
  USING (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS lead_sources_delete ON lead_sources;
CREATE POLICY lead_sources_delete ON lead_sources FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON lead_sources;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lead_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_source_id UUID NOT NULL REFERENCES lead_sources(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Nullable so history survives contact deletion (mirrors
  -- migration 004's pattern on broadcast_recipients / deals).
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT,
  -- Digits-only international form (no `+`), matching
  -- contacts.phone_normalized so dedupe is a plain equality check.
  phone TEXT,
  email TEXT,
  city TEXT,
  -- The enquiry text / requirement, provider-mapped.
  message TEXT,
  -- Untouched provider payload — audit trail + reprocessing.
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'contacted', 'qualified', 'invalid', 'duplicate')
  ),
  -- True when the phone already existed as a contact in this
  -- account (speed-to-lead still fires; the lead is marked so the
  -- team knows it wasn't net-new).
  deduped BOOLEAN NOT NULL DEFAULT FALSE,
  reply_sent BOOLEAN NOT NULL DEFAULT FALSE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_source
  ON leads(lead_source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_account_created
  ON leads(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_account_phone
  ON leads(account_id, phone) WHERE phone IS NOT NULL;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_select ON leads;
CREATE POLICY leads_select ON leads FOR SELECT
  USING (is_account_member(account_id));
DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert ON leads FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS leads_update ON leads;
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS leads_delete ON leads;
CREATE POLICY leads_delete ON leads FOR DELETE
  USING (is_account_member(account_id, 'admin'));
