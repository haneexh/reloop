-- ==============================================================================
-- RE:LOOP Migration 07: Dedicated AI Scan Cache Table & Event Log Audit Cleanup
-- Problem Statement: TH2-PS-SD-013 (Community E-Waste Collection Optimizer)
--
-- Objectives:
-- 1. Remove non-audit AI_SCAN_CACHE rows from event_log (append-only ledger).
--    The event_log trigger trigger_event_log_no_update_delete is safely disabled
--    during this administrative migration and immediately re-enabled.
-- 2. Create a dedicated ai_scan_cache table keyed by image SHA-256 with
--    provider, model, result jsonb, created_at, and hit_count.
-- 3. Enforce strict RLS blocking anonymous access, accessible only by server.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLEAN UP NON-AUDIT CACHE ROWS FROM EVENT_LOG
-- ------------------------------------------------------------------------------
-- Note: event_log has a trigger trigger_event_log_no_update_delete that raises
-- an exception on UPDATE or DELETE. We disable it for this migration cleanup only.
ALTER TABLE event_log DISABLE TRIGGER trigger_event_log_no_update_delete;

DELETE FROM event_log
WHERE event_type = 'AI_SCAN_CACHE';

ALTER TABLE event_log ENABLE TRIGGER trigger_event_log_no_update_delete;

-- ------------------------------------------------------------------------------
-- 2. CREATE DEDICATED AI_SCAN_CACHE TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_scan_cache (
  image_sha256 VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  hit_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_scan_cache_created_at ON ai_scan_cache(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) FOR AI_SCAN_CACHE
-- ------------------------------------------------------------------------------
ALTER TABLE ai_scan_cache ENABLE ROW LEVEL SECURITY;

-- Deny all anonymous access (anon cannot read, insert, update or delete cache entries)
DROP POLICY IF EXISTS "Deny anon access on ai_scan_cache" ON ai_scan_cache;
CREATE POLICY "Deny anon access on ai_scan_cache"
  ON ai_scan_cache
  FOR ALL
  TO anon
  USING (false);

-- Allow service role full management access (server routes only)
DROP POLICY IF EXISTS "Service role access on ai_scan_cache" ON ai_scan_cache;
CREATE POLICY "Service role access on ai_scan_cache"
  ON ai_scan_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
