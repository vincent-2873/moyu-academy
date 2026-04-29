SELECT key, length(value) AS val_len, updated_at
FROM public.system_secrets
WHERE key LIKE '%metabase%' OR key LIKE '%session%'
ORDER BY key;
