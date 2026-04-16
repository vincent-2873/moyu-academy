-- Backfill brand aliases for historical sales_metrics_daily rows
-- sixdigital → ooschool  /  xlab → aischool
-- 之前匯入時這些資料可能還用舊品牌名，造成 brandCompare 重複
UPDATE sales_metrics_daily SET brand = 'ooschool' WHERE brand = 'sixdigital';
UPDATE sales_metrics_daily SET brand = 'aischool' WHERE brand = 'xlab';
