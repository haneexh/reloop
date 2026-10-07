-- ==============================================================================
-- RE:LOOP Migration 04: PS-013 Community E-Waste Collection Optimizer Core Schema
-- Problem Statement: TH2-PS-SD-013
-- Safe, Non-Destructive Addition to Existing Schema
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. REUSABLE TRIGGER FOR UPDATED_AT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. COLLECTION ZONES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL CHECK (center_lat >= -90.0 AND center_lat <= 90.0),
  center_lng DOUBLE PRECISION NOT NULL CHECK (center_lng >= -180.0 AND center_lng <= 180.0),
  radius_km DOUBLE PRECISION NOT NULL CHECK (radius_km > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_zones_code ON collection_zones(code);

-- ------------------------------------------------------------------------------
-- 3. PROFILES / ROLE INFRASTRUCTURE (OPTIONAL AUTH EXTENSION)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'CITIZEN' CHECK (
    role IN ('CITIZEN', 'DISPATCHER', 'COLLECTOR', 'FACILITY', 'ADMIN')
  ),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Helper function to fetch caller role safely
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'ANONYMOUS';
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'CITIZEN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. COLLECTION REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_name TEXT,
  citizen_phone TEXT,
  address TEXT NOT NULL,
  zone_id UUID REFERENCES collection_zones(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION CHECK (lat IS NULL OR (lat >= -90.0 AND lat <= 90.0)),
  lng DOUBLE PRECISION CHECK (lng IS NULL OR (lng >= -180.0 AND lng <= 180.0)),
  pickup_date DATE,
  pickup_slot TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'scheduled',
      'assigned',
      'collected',
      'weighed',
      'sorted',
      'sent_to_facility',
      'recovered',
      'cancelled'
    )
  ),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  notes TEXT,
  qr_token TEXT UNIQUE,
  is_simulated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_requests_status ON collection_requests(status);
CREATE INDEX IF NOT EXISTS idx_collection_requests_zone_id ON collection_requests(zone_id);
CREATE INDEX IF NOT EXISTS idx_collection_requests_pickup_date ON collection_requests(pickup_date);
CREATE INDEX IF NOT EXISTS idx_collection_requests_created_at ON collection_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_requests_qr_token ON collection_requests(qr_token);
CREATE INDEX IF NOT EXISTS idx_collection_requests_simulated ON collection_requests(is_simulated);

CREATE TRIGGER trigger_collection_requests_updated_at
  BEFORE UPDATE ON collection_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. LINK EXISTING ITEMS TO REQUESTS (NON-DESTRUCTIVE ALTERATION)
-- ------------------------------------------------------------------------------
ALTER TABLE items 
  ADD COLUMN IF NOT EXISTS request_id UUID NULL REFERENCES collection_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_items_request_id ON items(request_id);

-- ------------------------------------------------------------------------------
-- 6. VEHICLES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code TEXT UNIQUE NOT NULL,
  capacity_kg NUMERIC NOT NULL CHECK (capacity_kg > 0),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('EV_VAN', 'CNG_TRUCK', 'MINI_TRUCK')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'assigned', 'in_route', 'maintenance', 'inactive')
  ),
  depot_name TEXT,
  depot_lat DOUBLE PRECISION CHECK (depot_lat IS NULL OR (depot_lat >= -90.0 AND depot_lat <= 90.0)),
  depot_lng DOUBLE PRECISION CHECK (depot_lng IS NULL OR (depot_lng >= -180.0 AND depot_lng <= 180.0)),
  max_route_hours NUMERIC DEFAULT 8 CHECK (max_route_hours > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);

-- ------------------------------------------------------------------------------
-- 7. COLLECTION ROUTES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES collection_zones(id) ON DELETE SET NULL,
  route_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled')
  ),
  total_distance_km NUMERIC DEFAULT 0 CHECK (total_distance_km >= 0),
  total_load_kg NUMERIC DEFAULT 0 CHECK (total_load_kg >= 0),
  estimated_duration_minutes INTEGER DEFAULT 0 CHECK (estimated_duration_minutes >= 0),
  stops_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_routes_vehicle_id ON collection_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_collection_routes_zone_id ON collection_routes(zone_id);
CREATE INDEX IF NOT EXISTS idx_collection_routes_route_date ON collection_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_collection_routes_status ON collection_routes(status);

CREATE TRIGGER trigger_collection_routes_updated_at
  BEFORE UPDATE ON collection_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. COLLECTION RECORDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES collection_requests(id) ON DELETE CASCADE,
  route_id UUID REFERENCES collection_routes(id) ON DELETE SET NULL,
  collector_id UUID NULL,
  actual_weight_kg NUMERIC NOT NULL CHECK (actual_weight_kg > 0),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_method TEXT DEFAULT 'manual' CHECK (
    verification_method IN ('manual', 'qr_scan', 'digital_scale')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_records_request_id ON collection_records(request_id);
CREATE INDEX IF NOT EXISTS idx_collection_records_route_id ON collection_records(route_id);
CREATE INDEX IF NOT EXISTS idx_collection_records_verified_at ON collection_records(verified_at DESC);

-- ------------------------------------------------------------------------------
-- 9. RECOVERY TRANSFERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  route_id UUID REFERENCES collection_routes(id) ON DELETE SET NULL,
  total_weight_kg NUMERIC NOT NULL CHECK (total_weight_kg > 0),
  refurbished_pct NUMERIC NOT NULL DEFAULT 0 CHECK (refurbished_pct >= 0 AND refurbished_pct <= 100),
  recycled_pct NUMERIC NOT NULL DEFAULT 0 CHECK (recycled_pct >= 0 AND recycled_pct <= 100),
  residual_pct NUMERIC NOT NULL DEFAULT 0 CHECK (residual_pct >= 0 AND residual_pct <= 100),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  CONSTRAINT recovery_transfers_pct_sum_check CHECK (
    (refurbished_pct + recycled_pct + residual_pct) <= 100
  )
);

CREATE INDEX IF NOT EXISTS idx_recovery_transfers_facility_id ON recovery_transfers(facility_id);
CREATE INDEX IF NOT EXISTS idx_recovery_transfers_route_id ON recovery_transfers(route_id);
CREATE INDEX IF NOT EXISTS idx_recovery_transfers_transferred_at ON recovery_transfers(transferred_at DESC);

-- ------------------------------------------------------------------------------
-- 10. APPEND-ONLY EVENT LOG TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_role TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_log_entity ON event_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON event_log(created_at DESC);

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) FOR PS-013 TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE collection_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 11.1 collection_zones (Public Read, Operator Manage)
CREATE POLICY "Zones public read"
  ON collection_zones FOR SELECT
  USING (true);

CREATE POLICY "Zones operator insert"
  ON collection_zones FOR INSERT
  WITH CHECK (
    get_current_user_role() IN ('DISPATCHER', 'ADMIN') OR auth.uid() IS NULL
  );

CREATE POLICY "Zones operator update"
  ON collection_zones FOR UPDATE
  USING (
    get_current_user_role() IN ('DISPATCHER', 'ADMIN') OR auth.uid() IS NULL
  );

-- 11.2 collection_requests
-- Public read for request status tracking by ID or QR token, or operational roles
CREATE POLICY "Requests read policy"
  ON collection_requests FOR SELECT
  USING (true);

-- Anyone can submit a collection request
CREATE POLICY "Requests citizen insert"
  ON collection_requests FOR INSERT
  WITH CHECK (true);

-- Operational roles can update status
CREATE POLICY "Requests status update"
  ON collection_requests FOR UPDATE
  USING (
    get_current_user_role() IN ('DISPATCHER', 'COLLECTOR', 'ADMIN') OR auth.uid() IS NULL
  );

-- 11.3 vehicles
CREATE POLICY "Vehicles read policy"
  ON vehicles FOR SELECT
  USING (true);

CREATE POLICY "Vehicles operator manage"
  ON vehicles FOR ALL
  USING (
    get_current_user_role() IN ('DISPATCHER', 'ADMIN') OR auth.uid() IS NULL
  );

-- 11.4 collection_routes
CREATE POLICY "Routes read policy"
  ON collection_routes FOR SELECT
  USING (true);

CREATE POLICY "Routes operator manage"
  ON collection_routes FOR ALL
  USING (
    get_current_user_role() IN ('DISPATCHER', 'ADMIN') OR auth.uid() IS NULL
  );

-- 11.5 collection_records
CREATE POLICY "Records read policy"
  ON collection_records FOR SELECT
  USING (true);

CREATE POLICY "Records collector insert"
  ON collection_records FOR INSERT
  WITH CHECK (true);

-- 11.6 recovery_transfers
CREATE POLICY "Transfers read policy"
  ON recovery_transfers FOR SELECT
  USING (true);

CREATE POLICY "Transfers facility insert"
  ON recovery_transfers FOR INSERT
  WITH CHECK (true);

-- 11.7 event_log: APPEND-ONLY PROTECTION
-- INSERT allowed; SELECT allowed; NO UPDATE policy; NO DELETE policy.
CREATE POLICY "Event log read policy"
  ON event_log FOR SELECT
  USING (true);

CREATE POLICY "Event log append only insert"
  ON event_log FOR INSERT
  WITH CHECK (true);

-- Explicitly disallow any UPDATE on event_log via a trigger guard
CREATE OR REPLACE FUNCTION prevent_event_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'event_log is strictly append-only. Modification or deletion is prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_event_log_no_update_delete ON event_log;
CREATE TRIGGER trigger_event_log_no_update_delete
  BEFORE UPDATE OR DELETE ON event_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_event_log_modification();

-- 11.8 profiles
CREATE POLICY "Profiles read own or admin"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id OR get_current_user_role() = 'ADMIN'
  );

CREATE POLICY "Profiles update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Profiles insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
