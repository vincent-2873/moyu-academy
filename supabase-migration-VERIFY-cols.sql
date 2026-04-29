-- Inventory actual columns
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_metrics_daily' ORDER BY ordinal_position;
