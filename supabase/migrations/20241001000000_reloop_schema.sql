-- ==============================================================================
-- RE:LOOP Supabase Schema Migration
-- Guest-only Circular Economy MVP
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ITEMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  item_type TEXT,                          -- e.g. "laptop", "smartphone", "chair"
  brand TEXT,
  estimated_age_years NUMERIC,
  condition TEXT,                          -- e.g. "functional", "cosmetic_damage", "severely_damaged"
  repair_cost_est NUMERIC,
  resale_value_est NUMERIC,
  co2e_saved_est NUMERIC,
  waste_avoided_kg NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for items
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_condition ON items(condition);

-- ------------------------------------------------------------------------------
-- 2. PARTNERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK (
    partner_type IN ('repair', 'ngo', 'recycler', 'refurbisher', 'informal')
  ),
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  city TEXT NOT NULL,
  contact TEXT,
  verified BOOLEAN DEFAULT true
);

-- Indexes for partners
CREATE INDEX IF NOT EXISTS idx_partners_partner_type ON partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_partners_city ON partners(city);
CREATE INDEX IF NOT EXISTS idx_partners_verified ON partners(verified);
CREATE INDEX IF NOT EXISTS idx_partners_coords ON partners(lat, lng);

-- ------------------------------------------------------------------------------
-- 3. RECOMMENDATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  recommended_action TEXT NOT NULL CHECK (
    recommended_action IN ('repair', 'reuse', 'donate', 'resell', 'refurbish', 'recycle')
  ),
  confidence NUMERIC,
  rationale TEXT,
  alt_action_1 TEXT,
  alt_action_2 TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_item_id ON recommendations(item_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_recommended_action ON recommendations(recommended_action);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR GUEST MVP
-- ------------------------------------------------------------------------------
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Items policies (public read & write for anonymous hackathon session)
CREATE POLICY "Public items access (select)"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Public items access (insert)"
  ON items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public items access (update)"
  ON items FOR UPDATE
  USING (true);

-- Partners policies (public read, insert)
CREATE POLICY "Public partners access (select)"
  ON partners FOR SELECT
  USING (true);

CREATE POLICY "Public partners access (insert)"
  ON partners FOR INSERT
  WITH CHECK (true);

-- Recommendations policies (public read & write)
CREATE POLICY "Public recommendations access (select)"
  ON recommendations FOR SELECT
  USING (true);

CREATE POLICY "Public recommendations access (insert)"
  ON recommendations FOR INSERT
  WITH CHECK (true);
