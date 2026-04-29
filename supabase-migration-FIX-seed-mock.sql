-- 補 mock data 讓 .single() 不崩 + 視覺效果
-- weekly_reports 1 row
INSERT INTO public.weekly_reports (user_email, week_start, week_end, metrics, status)
VALUES ('vincent@xuemi.co', '2026-04-22', '2026-04-28',
        '{"calls":150,"appointments":12,"closures":3,"revenue":850000}'::jsonb, 'published')
ON CONFLICT (id) DO NOTHING;

-- mentor_pairs: 補上 mentor_id / mentee_id 結構
ALTER TABLE public.mentor_pairs
  ADD COLUMN IF NOT EXISTS mentor_id UUID,
  ADD COLUMN IF NOT EXISTS mentee_id UUID,
  ADD COLUMN IF NOT EXISTS mentor_email TEXT,
  ADD COLUMN IF NOT EXISTS mentee_email TEXT;

UPDATE public.mentor_pairs SET
  mentor_email = COALESCE(mentor_email, 'vincent@xuemi.co'),
  mentee_email = COALESCE(mentee_email, 'vincent@xuemi.co')
WHERE mentor_email IS NULL OR mentee_email IS NULL;

-- announcements 多 2 條跑馬燈
INSERT INTO public.announcements (title, content, type, status, is_active, priority, created_at)
VALUES
  ('🚀 業務戰報', '本週新成交 3 筆,累計營收 NT$850,000', 'news', 'active', true, 'high', NOW() - INTERVAL '1 day'),
  ('📊 招聘戰線', 'Day 1-3 SOP 已上線,首批 7 位候選人進入漏斗', 'news', 'active', true, 'normal', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- 補 mock kpi_entries(/api/admin/boardroom 看 7d)
INSERT INTO public.kpi_entries (user_id, user_email, brand, date, calls, valid_calls, appointments, closures)
SELECT
  u.id,
  u.email,
  u.brand,
  CURRENT_DATE - g.day_offset,
  20 + (g.day_offset * 5)::INTEGER,
  10 + (g.day_offset * 2)::INTEGER,
  2 + g.day_offset::INTEGER,
  CASE WHEN g.day_offset = 0 THEN 1 ELSE 0 END
FROM public.users u
CROSS JOIN generate_series(0, 6) AS g(day_offset)
WHERE u.email = 'vincent@xuemi.co'
ON CONFLICT (id) DO NOTHING;

-- ── verify ──
SELECT 'weekly_reports' AS info, COUNT(*)::TEXT AS val FROM public.weekly_reports
UNION ALL SELECT 'announcements', COUNT(*)::TEXT FROM public.announcements
UNION ALL SELECT 'kpi_entries', COUNT(*)::TEXT FROM public.kpi_entries
UNION ALL SELECT 'mentor_pairs', COUNT(*)::TEXT FROM public.mentor_pairs;
