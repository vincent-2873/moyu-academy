SELECT email, name, role, capability_scope, stage_path, stage, is_active, length(password_hash) AS pwd_len
FROM public.users
WHERE email LIKE '%@demo.moyu'
ORDER BY email;
