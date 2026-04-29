SELECT
  'total' AS info, COUNT(*)::text AS val FROM public.sales_metrics_daily
UNION ALL SELECT 'distinct_dates', COUNT(DISTINCT date)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'distinct_people', COUNT(DISTINCT salesperson_id)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'date_range_min', MIN(date)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'date_range_max', MAX(date)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'sum_calls_2026', SUM(calls)::text FROM public.sales_metrics_daily WHERE date >= '2026-01-01'
UNION ALL SELECT 'sum_revenue_2026', SUM(net_revenue_daily)::text FROM public.sales_metrics_daily WHERE date >= '2026-01-01';
