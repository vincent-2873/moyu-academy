-- 一次性 inventory:看 system_secrets 有什麼 keys(不 print value)
SELECT key, length(value) AS val_len, created_at, updated_at
FROM public.system_secrets
ORDER BY key;
