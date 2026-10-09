-- ==============================================================================
-- RE:LOOP Migration 06: PS-013 Security Hardening & Strict RLS Lockdown
-- Problem Statement: TH2-PS-SD-013 (Community E-Waste Collection Optimizer)
--
-- Security Objectives:
-- 1. Anonymous users CANNOT list collection_requests or read other citizens' PII.
-- 2. Anonymous users CAN ONLY insert new collection requests and read by exact tracking token (non-PII).
-- 3. Anonymous users CANNOT update or delete rows in items.
-- 4. Anonymous users CANNOT insert into collection_records or recovery_transfers.
-- 5. Operator/collector writes MUST use service role via server routes.
-- 6. event_log remains strictly append-only (no update/delete) and readable only by service role.
-- 7. Public read allowed ONLY for public tables (partners, collection_zones).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COLLECTION_REQUESTS SECURITY HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Requests read policy" ON collection_requests;
DROP POLICY IF EXISTS "Requests status update" ON collection_requests;
DROP POLICY IF EXISTS "Requests citizen insert" ON collection_requests;
DROP POLICY IF EXISTS "Requests service role read" ON collection_requests;
DROP POLICY IF EXISTS "Requests service role update" ON collection_requests;
DROP POLICY IF EXISTS "Requests service role delete" ON collection_requests;

-- Anyone (citizen) can insert a new collection request
CREATE POLICY "Requests citizen insert"
  ON collection_requests FOR INSERT
  WITH CHECK (true);

-- Anonymous users cannot SELECT arbitrary rows from collection_requests directly.
-- Only the service role key (used by server routes) can SELECT, UPDATE, or DELETE requests directly.
CREATE POLICY "Requests service role read"
  ON collection_requests FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Requests service role update"
  ON collection_requests FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Requests service role delete"
  ON collection_requests FOR DELETE
  USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 2. ITEMS SECURITY HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public items access (select)" ON items;
DROP POLICY IF EXISTS "Public items access (insert)" ON items;
DROP POLICY IF EXISTS "Public items access (update)" ON items;
DROP POLICY IF EXISTS "Public items access (delete)" ON items;
DROP POLICY IF EXISTS "Items public select" ON items;
DROP POLICY IF EXISTS "Items public insert" ON items;
DROP POLICY IF EXISTS "Items service role update" ON items;
DROP POLICY IF EXISTS "Items service role delete" ON items;

-- Public can read items (for catalog / device taxonomy)
CREATE POLICY "Items public select"
  ON items FOR SELECT
  USING (true);

-- Public can insert items (associated with collection intake)
CREATE POLICY "Items public insert"
  ON items FOR INSERT
  WITH CHECK (true);

-- Anonymous clients CANNOT update or delete rows in items
CREATE POLICY "Items service role update"
  ON items FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Items service role delete"
  ON items FOR DELETE
  USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 3. COLLECTION_RECORDS SECURITY HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Records read policy" ON collection_records;
DROP POLICY IF EXISTS "Records collector insert" ON collection_records;
DROP POLICY IF EXISTS "Records service role read" ON collection_records;
DROP POLICY IF EXISTS "Records service role insert" ON collection_records;

-- Only service role (via server route /api/collector/collect) can read or insert records
CREATE POLICY "Records service role read"
  ON collection_records FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Records service role insert"
  ON collection_records FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 4. RECOVERY_TRANSFERS SECURITY HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Transfers read policy" ON recovery_transfers;
DROP POLICY IF EXISTS "Transfers facility insert" ON recovery_transfers;
DROP POLICY IF EXISTS "Transfers service role read" ON recovery_transfers;
DROP POLICY IF EXISTS "Transfers service role insert" ON recovery_transfers;

-- Only service role (via server route /api/recovery/transfers) can read or insert transfers
CREATE POLICY "Transfers service role read"
  ON recovery_transfers FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Transfers service role insert"
  ON recovery_transfers FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 5. COLLECTION_ROUTES SECURITY HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Routes read policy" ON collection_routes;
DROP POLICY IF EXISTS "Routes operator manage" ON collection_routes;
DROP POLICY IF EXISTS "Routes service role manage" ON collection_routes;

CREATE POLICY "Routes service role manage"
  ON collection_routes FOR ALL
  USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 6. EVENT_LOG APPEND-ONLY PROTECTION & READ LOCKDOWN
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Event log read policy" ON event_log;
DROP POLICY IF EXISTS "Event log append only insert" ON event_log;
DROP POLICY IF EXISTS "Event log service role read" ON event_log;
DROP POLICY IF EXISTS "Event log service role append" ON event_log;

-- Anonymous users CANNOT read internal event logs
CREATE POLICY "Event log service role read"
  ON event_log FOR SELECT
  USING (auth.role() = 'service_role');

-- Server routes can append events
CREATE POLICY "Event log service role append"
  ON event_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Explicit trigger ensuring event_log remains strictly append-only (No UPDATE, No DELETE)
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

-- ------------------------------------------------------------------------------
-- 7. PUBLIC TABLES (ZONES & PARTNERS)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Zones public read" ON collection_zones;
DROP POLICY IF EXISTS "Zones operator insert" ON collection_zones;
DROP POLICY IF EXISTS "Zones operator update" ON collection_zones;
DROP POLICY IF EXISTS "Partners public read" ON partners;
DROP POLICY IF EXISTS "Public partners access (select)" ON partners;
DROP POLICY IF EXISTS "Public partners access (insert)" ON partners;

CREATE POLICY "Zones public read"
  ON collection_zones FOR SELECT
  USING (true);

CREATE POLICY "Partners public read"
  ON partners FOR SELECT
  USING (true);

-- ------------------------------------------------------------------------------
-- 8. SECURITY DEFINER FUNCTION FOR CITIZEN TRACKING (NON-PII ONLY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_request_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  qr_token TEXT,
  status TEXT,
  priority TEXT,
  pickup_date DATE,
  pickup_slot TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  zone_id UUID,
  is_simulated BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.qr_token,
    cr.status::TEXT,
    cr.priority::TEXT,
    cr.pickup_date,
    cr.pickup_slot,
    cr.created_at,
    cr.updated_at,
    cr.zone_id,
    cr.is_simulated
  FROM collection_requests cr
  WHERE cr.qr_token = UPPER(TRIM(p_token));
END;
$$;

GRANT EXECUTE ON FUNCTION get_request_by_token(TEXT) TO anon, authenticated;
