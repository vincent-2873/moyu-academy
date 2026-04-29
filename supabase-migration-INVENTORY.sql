-- 一次性 inventory 用,跑完 verify 用,不算正式 migration
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
