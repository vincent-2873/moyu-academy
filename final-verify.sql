SELECT 'sales_total' AS k, COUNT(*)::text AS v FROM public.sales_metrics_daily
UNION ALL SELECT 'sales_distinct_dates', COUNT(DISTINCT date)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'sales_distinct_people', COUNT(DISTINCT salesperson_id)::text FROM public.sales_metrics_daily
UNION ALL SELECT 'knowledge_chunks', COUNT(*)::text FROM public.knowledge_chunks
UNION ALL SELECT 'knowledge_with_embedding', COUNT(*) FILTER (WHERE embedding IS NOT NULL)::text FROM public.knowledge_chunks
UNION ALL SELECT 'training_assignments_active', COUNT(*) FILTER (WHERE status='active')::text FROM public.training_assignments
UNION ALL SELECT 'training_modules_business', COUNT(*)::text FROM public.training_modules tm JOIN public.training_paths tp ON tm.path_id=tp.id WHERE tp.code='business_default'
UNION ALL SELECT 'training_modules_recruit', COUNT(*)::text FROM public.training_modules tm JOIN public.training_paths tp ON tm.path_id=tp.id WHERE tp.code='recruit_default'
UNION ALL SELECT 'sales_alert_rules', COUNT(*)::text FROM public.sales_alert_rules
UNION ALL SELECT 'kpi_targets', COUNT(*)::text FROM public.kpi_targets
UNION ALL SELECT 'announcements', COUNT(*)::text FROM public.announcements
UNION ALL SELECT 'users_demo', COUNT(*)::text FROM public.users WHERE email LIKE '%@demo.moyu';
