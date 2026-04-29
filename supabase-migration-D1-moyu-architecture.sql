-- D1: 墨宇生態架構大改
-- Vincent 拍板架構:
--   業務本體 = 墨宇生態(墨宇 + 經銷)
--   業務線(4 條): 財經 / 職能 / 實體 / 未來學院
--   實體據點(3 處): 台北延平 / 台中民權 / 高雄中山
--   據點主管(5 人): Rita / Terry / Alan / Lance / Vincent
--   品牌(從 X Platform 對外,但本系統用做業務分類):
--     XLAB / nSchool財經 / nSchool職能 / 無限學院 / 學米 / 未來學院

-- 1. business_lines 表(4 業務線)
CREATE TABLE IF NOT EXISTS public.business_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  color_hex text,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 2. locations 表(3 實體據點)
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  city text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 3. location_managers 關聯表(據點 × 業務線 × 主管)
CREATE TABLE IF NOT EXISTS public.location_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  business_line_id uuid NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  manager_user_id uuid REFERENCES public.users(id),
  manager_name text NOT NULL,                 -- 即使沒對應 user account 也能存
  brand text,                                  -- XLAB / nSchool / 無限 / 學米 / 未來
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, business_line_id, manager_name)
);

CREATE INDEX IF NOT EXISTS idx_loc_mgr_location ON public.location_managers(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_mgr_business_line ON public.location_managers(business_line_id);

-- 4. users 加 location + business_line + brand 對應
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
  ADD COLUMN IF NOT EXISTS business_line_id uuid REFERENCES public.business_lines(id),
  ADD COLUMN IF NOT EXISTS report_to_user_id uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(location_id);
CREATE INDEX IF NOT EXISTS idx_users_business_line ON public.users(business_line_id);

-- 5. Seed business_lines
INSERT INTO public.business_lines (code, name, description, color_hex, display_order) VALUES
  ('finance', '財經', 'nSchool 財經學院 — 投資理財教育', '#b91c1c', 1),
  ('function', '職能', '無限學院 / 學米 / 適所 — 職涯轉型教育', '#1a1a1a', 2),
  ('physical', '實體', 'XLAB AI 實驗室 — NoCode + AI 自動化實戰', '#c9a96e', 3),
  ('future', '未來學院', 'AI 未來學院 — AI 工具 + 應用教學(新成立)', '#4a4a4a', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  updated_at = NOW();

-- 6. Seed locations
INSERT INTO public.locations (code, name, city) VALUES
  ('taipei_yanping', '台北延平', '台北市'),
  ('taichung_minquan', '台中民權', '台中市'),
  ('kaohsiung_zhongshan', '高雄中山', '高雄市')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  updated_at = NOW();

-- 7. Seed location_managers (Vincent 給的 9 個對應)
WITH locs AS (
  SELECT code, id FROM public.locations
), bls AS (
  SELECT code, id FROM public.business_lines
)
INSERT INTO public.location_managers (location_id, business_line_id, manager_name, brand)
SELECT l.id, b.id, m.manager_name, m.brand FROM (
  VALUES
    ('taipei_yanping',     'physical', 'Rita',    'XLAB'),
    ('taipei_yanping',     'finance',  'Terry',   'nSchool 財經'),
    ('taipei_yanping',     'function', 'Terry',   '無限學院'),
    ('taipei_yanping',     'finance',  'Alan',    'nSchool 財經'),
    ('taichung_minquan',   'physical', 'Alan',    'XLAB'),
    ('taichung_minquan',   'finance',  'Alan',    'nSchool 財經'),
    ('taichung_minquan',   'function', 'Alan',    '無限學院'),
    ('kaohsiung_zhongshan','function', 'Lance',   '學米'),
    ('kaohsiung_zhongshan','future',   'Vincent', '未來學院')
) AS m(loc_code, bl_code, manager_name, brand)
JOIN locs l ON l.code = m.loc_code
JOIN bls b ON b.code = m.bl_code
ON CONFLICT (location_id, business_line_id, manager_name) DO UPDATE SET
  brand = EXCLUDED.brand;

-- 8. 把 Vincent 的 user 連到 manager_user_id
UPDATE public.location_managers lm
  SET manager_user_id = u.id
FROM public.users u
WHERE u.email = 'vincent@xuemi.co' AND lm.manager_name = 'Vincent';

-- 9. Verify
SELECT 'business_lines' AS table_name, COUNT(*) AS cnt FROM public.business_lines
UNION ALL SELECT 'locations', COUNT(*) FROM public.locations
UNION ALL SELECT 'location_managers', COUNT(*) FROM public.location_managers
UNION ALL SELECT 'managers_with_user_id', COUNT(*) FROM public.location_managers WHERE manager_user_id IS NOT NULL;

-- 10. View: 整合視角
CREATE OR REPLACE VIEW public.location_manager_view AS
SELECT
  l.name AS location_name,
  bl.name AS business_line_name,
  lm.manager_name,
  lm.brand,
  u.email AS manager_email
FROM public.location_managers lm
JOIN public.locations l ON l.id = lm.location_id
JOIN public.business_lines bl ON bl.id = lm.business_line_id
LEFT JOIN public.users u ON u.id = lm.manager_user_id
ORDER BY l.code, bl.code;

SELECT * FROM public.location_manager_view;
