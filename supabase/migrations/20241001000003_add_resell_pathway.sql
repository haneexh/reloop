-- ==============================================================================
-- Migration: Add 'resell' to recommendations recommended_action CHECK constraint
-- ==============================================================================

ALTER TABLE recommendations 
  DROP CONSTRAINT IF EXISTS recommendations_recommended_action_check;

ALTER TABLE recommendations 
  ADD CONSTRAINT recommendations_recommended_action_check 
  CHECK (recommended_action IN ('repair', 'reuse', 'donate', 'resell', 'refurbish', 'recycle'));
