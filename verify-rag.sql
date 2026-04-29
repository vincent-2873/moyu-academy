SELECT 'knowledge_chunks_total' AS info, COUNT(*)::text AS val FROM public.knowledge_chunks
UNION ALL SELECT 'with_embedding', COUNT(*)::text FROM public.knowledge_chunks WHERE embedding IS NOT NULL
UNION ALL SELECT 'sales_metrics_total', COUNT(*)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'sales_revenue_2026', SUM(net_revenue_daily)::text FROM public.sales_metrics_daily WHERE date >= '2026-01-01';
