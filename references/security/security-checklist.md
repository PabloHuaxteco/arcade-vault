## Checklist de seguridad básico

  - [ ] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores`
  - [ ] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4)
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
  - [ ] Headers de seguridad en Next.js
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el lado de Supabase:

| name                            | title                               | level | facing   | categories   | description                                                                                                                                                                                                                                                                                    | detail                                                                                                                                                                                                   | remediation                                                                                              | metadata                                                                                                                                                                                                            | cache_key                                                      | observed_at              |
| ------------------------------- | ----------------------------------- | ----- | -------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------ |
| rls_policy_always_true          | RLS Policy Always True              | WARN  | EXTERNAL | ["SECURITY"] | Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access. | Table `public.scores` has an RLS policy `anyone can insert a score` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for -. | https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy                | {"schema":"public","name":"scores","type":"table","qual":null,"roles":["-"],"command":"INSERT","with_check":"true","policy_name":"anyone can insert a score","permissive_using":false,"permissive_with_check":true} | rls_policy_always_true_public_scores_anyone can insert a score | 2026-09-17T17:51:05.141Z |
| auth_leaked_password_protection | Leaked Password Protection Disabled | WARN  | EXTERNAL | ["SECURITY"] | Leaked password protection is currently disabled.                                                                                                                                                                                                                                              | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.                                                                 | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection | {"entity":"Auth","type":"auth"}                                                                                                                                                                                     | auth_leaked_password_protection                                |                          |
