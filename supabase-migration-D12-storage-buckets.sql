-- D12 Supabase Storage buckets:訓練影片 + 對練錄音
-- ⚠️ Storage bucket 通常用 Dashboard 建,SQL 補不齊全。如果 SQL 失敗請手動到
--   https://supabase.com/dashboard/project/nqegeidvsflkwllnfink/storage/buckets
--   建以下 2 個 bucket:
--     - training-videos (public=true)   ── 訓練影片(< 1GB 免費)
--     - training-audio (public=false)   ── HRBP CALL 對練錄音

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('training-videos', 'training-videos', true, 524288000, ARRAY['video/mp4','video/webm','video/quicktime','video/x-matroska']),
  ('training-audio', 'training-audio', false, 104857600, ARRAY['audio/mpeg','audio/wav','audio/x-m4a','audio/webm','audio/ogg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS:service_role 全權,authenticated user 可 read public bucket
DO $$ BEGIN
  CREATE POLICY "service_role training-videos all" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'training-videos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role training-audio all" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'training-audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read training-videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'training-videos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT id, public, file_size_limit FROM storage.buckets WHERE id IN ('training-videos','training-audio');
