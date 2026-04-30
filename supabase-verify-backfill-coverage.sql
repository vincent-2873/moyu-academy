-- B6: backfill coverage verify (Vincent 2026-04-30 反饋:484 天只有 100 天有資料)
-- 跑透過 GitHub Actions apply-migration workflow,response 含 SELECT 結果
--
-- 目的:確認 484 天區間中,扣除週末/假日後應該有資料的工作日數,跟實際有資料的日期數比較。
-- 如果差距大 → 真的有缺資料,需 trigger metabase-backfill。
-- 如果差距小 → 100 天 ≈ 工作日數,屬正常(週末/開設前期沒員工上班)。

WITH date_range AS (
  -- earliest 和 latest 日期(從 sales_metrics_daily)
  SELECT
    MIN(date) AS earliest,
    MAX(date) AS latest
  FROM sales_metrics_daily
),
calendar AS (
  -- generate 從 earliest 到 latest 的所有日期 (calendar)
  SELECT generate_series(
    (SELECT earliest FROM date_range)::date,
    (SELECT latest FROM date_range)::date,
    '1 day'::interval
  )::date AS d
),
classified AS (
  SELECT
    d,
    EXTRACT(DOW FROM d) AS dow,  -- 0=Sun, 6=Sat
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6) THEN 'weekend' ELSE 'workday' END AS day_type
  FROM calendar
),
data_days AS (
  -- 哪些日期實際有資料
  SELECT DISTINCT date AS d FROM sales_metrics_daily
)
SELECT
  (SELECT earliest FROM date_range) AS earliest_date,
  (SELECT latest FROM date_range) AS latest_date,
  (SELECT latest::date - earliest::date + 1 FROM date_range) AS total_calendar_days,
  COUNT(*) FILTER (WHERE day_type = 'workday') AS expected_workdays,
  COUNT(*) FILTER (WHERE day_type = 'weekend') AS weekends,
  (SELECT COUNT(*) FROM data_days) AS actual_data_days,
  (SELECT COUNT(*) FROM data_days WHERE EXISTS (
    SELECT 1 FROM classified c WHERE c.d = data_days.d AND c.day_type = 'workday'
  )) AS data_days_on_workdays,
  -- gap 分析
  COUNT(*) FILTER (WHERE day_type = 'workday')
    - (SELECT COUNT(*) FROM data_days WHERE EXISTS (
        SELECT 1 FROM classified c WHERE c.d = data_days.d AND c.day_type = 'workday'
      )) AS missing_workdays,
  -- 涵蓋率
  ROUND(
    100.0 * (SELECT COUNT(*) FROM data_days WHERE EXISTS (
      SELECT 1 FROM classified c WHERE c.d = data_days.d AND c.day_type = 'workday'
    )) / NULLIF(COUNT(*) FILTER (WHERE day_type = 'workday'), 0),
    1
  ) AS coverage_workday_pct
FROM classified;

-- 第二查詢:列出最近 30 個工作日中沒資料的日期(找 gap 補洞用)
WITH calendar AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '60 days')::date,
    CURRENT_DATE::date,
    '1 day'::interval
  )::date AS d
),
data_days AS (
  SELECT DISTINCT date FROM sales_metrics_daily
)
SELECT
  c.d AS missing_date,
  CASE EXTRACT(DOW FROM c.d)
    WHEN 0 THEN 'Sun'
    WHEN 1 THEN 'Mon'
    WHEN 2 THEN 'Tue'
    WHEN 3 THEN 'Wed'
    WHEN 4 THEN 'Thu'
    WHEN 5 THEN 'Fri'
    WHEN 6 THEN 'Sat'
  END AS dow_name
FROM calendar c
WHERE EXTRACT(DOW FROM c.d) NOT IN (0, 6)  -- 只看工作日
  AND NOT EXISTS (SELECT 1 FROM data_days dd WHERE dd.date = c.d)
ORDER BY c.d DESC;
