# Runbook: llevar el esquema de Supabase de dev a producción

Este documento lo ejecutas **tú**, en tu propia terminal o en el panel de
Supabase. Claude (vía MCP) solo tiene acceso al proyecto de **desarrollo**
(`mohwuulzonfjtqhkejko`); no toques `.mcp.json` ni pegues aquí credenciales
de producción en una conversación con el agente — este archivo es solo una
guía de pasos, no un canal para ejecutar nada contra prod.

## Qué vas a migrar

Solo esquema + catálogo. **No** se migran los 107 scores de dev (son datos de
prueba) ni el usuario de dev (`auth.users`). Producción arranca con:

- Tablas `games` (9 filas) y `scores` (vacía) con RLS y las mismas políticas.
- Índice `scores_game_id_score_idx`.

## Vía A — Supabase CLI (recomendada)

Desde la raíz del repo (ya tiene `supabase/config.toml` y
`supabase/migrations/`):

```bash
npx supabase login
# Abre el navegador y genera un access token; se guarda solo en tu máquina.

npx supabase link --project-ref <REF_PROD>
# <REF_PROD> es el ID de tu proyecto de producción, el que aparece en su URL
# https://<REF_PROD>.supabase.co (Project Settings → General).
# Te pedirá la contraseña de la base de datos de producción (la que pusiste
# al crear el proyecto, o Project Settings → Database → Reset database
# password si no la recuerdas).

npx supabase db push
# Aplica, en orden, las 5 migraciones de supabase/migrations/.

npx supabase migration list
# Debe mostrar las 5 versiones como aplicadas tanto en local como en remoto.
```

Si en algún punto quieres reconstruir un entorno de **desarrollo** nuevo
desde cero (no producción), después de `db push` puedes ejecutar además
`supabase/seed-dev-scores.sql` para recuperar el leaderboard ficticio.
**Nunca ejecutes ese archivo contra producción.**

## Vía B — SQL Editor del panel (si no quieres usar la CLI)

En el panel de producción → _SQL Editor_, pega y ejecuta, **en este orden**,
el contenido de cada archivo de `supabase/migrations/`:

1. `20260911020508_create_games_and_scores.sql`
2. `20260911210530_activate_arkanoid_engine_bloque_buster.sql`
3. `20260911231335_set_snake_engine_and_long_serpentina.sql`
4. `20260914002829_insert_salta_charcos_game.sql`
5. `20260917204011_spec_12_scores_user_id_and_insert_policy.sql`

Si más adelante quieres empezar a usar la CLI contra este mismo proyecto de
producción, registra las 5 versiones como ya aplicadas para que
`supabase db push` no intente reejecutarlas:

```sql
insert into supabase_migrations.schema_migrations (version, name) values
('20260911020508', 'create_games_and_scores'),
('20260911210530', 'activate_arkanoid_engine_bloque_buster'),
('20260911231335', 'set_snake_engine_and_long_serpentina'),
('20260914002829', 'insert_salta_charcos_game'),
('20260917204011', 'spec_12_scores_user_id_and_insert_policy');
```

## Checklist manual en el panel de producción

Nada de esto viaja por SQL — son ajustes de proyecto que hay que repetir a
mano en la instancia de producción.

1. **API Keys.** _Project Settings → API Keys_: copia `Project URL` y la
   clave `sb_publishable_…`. Van a `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de producción (ver
   `.env.production.local.example`).

2. **URL Configuration.** _Authentication → URL Configuration_:
   - `Site URL` = tu dominio de producción (p. ej. `https://arcade-vault.com`).
   - `Redirect URLs` debe incluir `https://<tu-dominio>/auth/callback`.
     `app/_components/session-provider.tsx` construye `redirectTo` con
     `window.location.origin`, así que sin esta entrada el login con OAuth y
     la recuperación de contraseña fallan en producción.

3. **Providers.** _Authentication → Sign In / Providers_:
   - Email/contraseña habilitado (decide si exiges confirmación de correo).
   - Google y GitHub con **credenciales nuevas**, no las de dev. En Google
     Cloud Console y en la OAuth App de GitHub, añade el redirect URI
     `https://<REF_PROD>.supabase.co/auth/v1/callback` — el de dev apunta a
     otro proyecto y no sirve.

4. **Attack Protection.** _Authentication → Attack Protection_: activa
   **Leaked password protection**. En dev está desactivada (advisor
   `auth_leaked_password_protection`, WARN); en producción conviene
   activarla desde el día 1.

5. **Correo saliente.** El SMTP por defecto de Supabase tiene un límite bajo
   de correos por hora, pensado solo para pruebas. Como el proyecto ya usa
   Resend para `/acerca`, lo más simple es configurar Resend como SMTP
   personalizado en _Authentication → Emails → SMTP Settings_ para que los
   correos de confirmación/recuperación de cuenta salgan igual de fiables.

6. **Backups.** _Database → Backups_: confirma la política de backups del
   plan contratado para producción.

7. **Advisors.** Tras aplicar las migraciones, revisa _Advisors → Security_
   en el proyecto de producción: no debería reportar `rls_disabled_in_public`
   ni políticas inesperadas. Compara contra lo esperado (RLS activo en
   `games` y `scores`, 3 políticas: 2 SELECT públicas + 1 INSERT restringida
   a `auth.uid() = user_id`).

## Verificación final

En el SQL Editor de producción:

```sql
select count(*) from public.games;   -- 9
select count(*) from public.scores;  -- 0
select policyname, cmd from pg_policies where schemaname = 'public';
select relrowsecurity from pg_class where relname in ('games', 'scores'); -- true, true
```

Con `.env.production.local` relleno:

```bash
npm run build && npm start
```

- `/debug/supabase` → `CONECTADO`.
- `/biblioteca` → lista los 9 juegos.
- `/salon` → sale vacío (correcto: sin scores de prueba).
- Regístrate con email, luego prueba login con Google y con GitHub.
- Juega una partida y guarda puntuación: debe insertarse con tu `user_id`.
  Cierra sesión e intenta guardar de nuevo: la política debe rechazarlo.
- Envía el formulario de `/acerca` para confirmar que Resend funciona en
  este entorno.
