-- 單 SELECT 撈所有 stats (Supabase Management API 只 return last statement)

SELECT
  (SELECT COUNT(*) FROM public.sales_metrics_daily)::int AS total_rows,
  (SELECT COUNT(DISTINCT email) FROM public.sales_metrics_daily WHERE email IS NOT NULL)::int AS distinct_emails,
  (SELECT MAX(date)::text FROM public.sales_metrics_daily) AS max_date,
  (SELECT MIN(date)::text FROM public.sales_metrics_daily) AS min_date,
  (SELECT COUNT(DISTINCT email) FROM public.sales_metrics_daily WHERE name LIKE '新訓-%' OR name LIKE '新訓 %' OR name LIKE '新訓:%')::int AS xunlian_distinct,
  (SELECT COUNT(*) FROM public.users)::int AS users_total,
  (SELECT COUNT(*) FROM public.users WHERE is_active = true)::int AS users_active,
  (SELECT COUNT(*) FROM public.stamp_rules)::int AS stamp_rules_count,
  (SELECT string_agg(id, ',') FROM storage.buckets WHERE id IN ('training-videos','training-audio')) AS storage_buckets,
  (SELECT COUNT(DISTINCT email) FROM public.sales_metrics_daily smd
   WHERE email IS NOT NULL
     AND NOT (name LIKE '新訓-%' OR name LIKE '新訓 %' OR name LIKE '新訓:%')
     AND email NOT IN (SELECT email FROM public.users))::int AS new_users_to_create;
