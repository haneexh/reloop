-- ==============================================================================
-- RE:LOOP Supabase Storage Bucket Setup
-- ==============================================================================

-- Create "item-photos" bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public Storage Policies for item-photos
CREATE POLICY "Public items photos access (select)"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'item-photos');

CREATE POLICY "Public items photos upload (insert)"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'item-photos');

CREATE POLICY "Public items photos update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'item-photos');
