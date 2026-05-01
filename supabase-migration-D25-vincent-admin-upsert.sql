-- D25: UPSERT vincent@xuemi.co admin 帳號(密碼 0000)
-- 2026-05-01
--
-- 對齊:/api/admin/auth 期待 user.password_hash(bcrypt)+ user.role IN ALLOWED_ROLES
-- 用 Postgres pgcrypto crypt('0000', gen_salt('bf', 10)) 產 bcrypt-compat hash
--   bcryptjs.compare('0000', hash) === true(bcrypt $2a$ / $2b$ 標準格式)
-- 紅線 1:0000 是 Vincent 自己給的明文,只進 SQL crypt() function,不寫進 chat / log
--
-- ⚠️ 注意:此 password 是 dev 預設,登入後請改

-- 確保 pgcrypto extension 開了
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── PART 1: 若 vincent@xuemi.co 不存在 → INSERT ─────────────────────────────

INSERT INTO users (email, name, password_hash, role, created_at)
SELECT
  'vincent@xuemi.co',
  'Vincent',
  crypt('0000', gen_salt('bf', 10)),
  'super_admin',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'vincent@xuemi.co');

-- ─── PART 2: 若已存在 → UPDATE password_hash(保證 0000 可登)+ 升 super_admin ──

UPDATE users
SET
  password_hash = crypt('0000', gen_salt('bf', 10)),
  role = CASE
    -- 若已是 ALLOWED_ROLES 內角色就保留(不降級)
    WHEN role IN ('super_admin','ceo','coo','cfo','director','brand_manager','sales_manager','legal_manager','team_leader')
      THEN role
    -- 否則改 super_admin(讓 Vincent 一定能進後台)
    ELSE 'super_admin'
  END
WHERE email = 'vincent@xuemi.co';

-- ─── verify ──────────────────────────────────────────────────────────────────
-- 預期:
-- SELECT email, name, role, password_hash IS NOT NULL AS has_pw FROM users WHERE email='vincent@xuemi.co';
-- 應回:vincent@xuemi.co | Vincent | super_admin | true
