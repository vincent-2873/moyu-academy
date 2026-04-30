-- VERIFY ONLY (read-only):看 sales_metrics_daily 真實同步狀態 + users 對齊
-- Run via apply-migration workflow (Supabase Management API 接受任意 SQL)

SELECT 'total_rows' AS k, COUNT(*)::text AS v FROM public.sales_metrics_daily
UNION ALL SELECT 'min_date', COALESCE(MIN(date)::text, '(無)') FROM public.sales_metrics_daily
UNION ALL SELECT 'max_date', COALESCE(MAX(date)::text, '(無)') FROM public.sales_metrics_daily
UNION ALL SELECT 'distinct_emails', COUNT(DISTINCT email)::text FROM public.sales_metrics_daily WHERE email IS NOT NULL
UNION ALL SELECT 'xunlian_distinct', COUNT(DISTINCT email)::text FROM public.sales_metrics_daily WHERE name LIKE '新訓-%' OR name LIKE '新訓 %' OR name LIKE '新訓:%'
UNION ALL SELECT 'users_total', COUNT(*)::text FROM public.users
UNION ALL SELECT 'users_active', COUNT(*)::text FROM public.users WHERE is_active = true
UNION ALL SELECT 'stamp_rules_count', COUNT(*)::text FROM public.stamp_rules
UNION ALL SELECT 'storage_buckets', string_agg(id, ',') FROM storage.buckets WHERE id IN ('training-videos','training-audio');

SELECT brand,
       COUNT(*)::int AS rows,
       COUNT(DISTINCT email)::int AS distinct_users,
       MAX(date)::text AS latest
FROM public.sales_metrics_daily
GROUP BY brand
ORDER BY rows DESC;
