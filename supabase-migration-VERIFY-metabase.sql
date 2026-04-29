SELECT 'total_rows' AS info, COUNT(*)::TEXT AS val FROM public.sales_metrics_daily
UNION ALL SELECT 'distinct_dates', COUNT(DISTINCT date)::TEXT FROM public.sales_metrics_daily
UNION ALL SELECT 'distinct_people', COUNT(DISTINCT salesperson_id)::TEXT FROM public.sales_metrics_daily
UNION ALL SELECT 'date_range', MIN(date)::TEXT || ' → ' || MAX(date)::TEXT FROM public.sales_metrics_daily
UNION ALL SELECT 'sum_calls_2026_04', SUM(calls)::TEXT FROM public.sales_metrics_daily WHERE date BETWEEN '2026-04-01' AND '2026-04-30'
UNION ALL SELECT 'sum_revenue_2026_04', COALESCE(SUM(net_revenue_daily), 0)::TEXT FROM public.sales_metrics_daily WHERE date BETWEEN '2026-04-01' AND '2026-04-30'
UNION ALL SELECT 'sample_top_caller',
  (SELECT name || ' (' || calls::TEXT || ' calls / ' || date::TEXT || ')'
   FROM public.sales_metrics_daily
   WHERE date BETWEEN '2026-04-01' AND '2026-04-30'
   ORDER BY calls DESC NULLS LAST
   LIMIT 1);
