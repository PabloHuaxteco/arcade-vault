## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Hola mundo

## Variables de entorno

El formulario de contacto de `/acerca` envía correos con [Resend](https://resend.com)
desde una Server Action. Copia `.env.example` a `.env.local` (no versionado) y
rellena estas dos variables:

- `RESEND_API_KEY` — API key generada en el panel de Resend.
- `CONTACT_TO` — dirección de destino de los mensajes. Con el remitente
  `onboarding@resend.dev` (el que usa el proyecto), Resend solo entrega a la
  dirección dueña de la cuenta Resend.

Sin estas variables el resto del sitio funciona; solo el envío del formulario
mostrará un error inline.

### Supabase

La conexión base con Supabase usa `@supabase/ssr` (clientes en `lib/supabase/`).
Copia también estas dos variables de `.env.example` a `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto (`https://<project-ref>.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — clave `sb_publishable_…`, pública por
  diseño. Ambas salen del panel de Supabase → Project Settings → API Keys.

Con las dos puestas, la ruta temporal `/debug/supabase` muestra `CONECTADO`.

### Dev vs producción

El proyecto usa **dos instancias de Supabase separadas**, una por entorno.
En local, `.env.local` siempre apunta al proyecto de **desarrollo** — es el
único al que Claude Code tiene acceso, vía el servidor MCP `supabase`
declarado en `.mcp.json`. El proyecto de **producción** no está conectado a
ningún agente ni MCP: sus credenciales solo viven en el hosting (por
ejemplo, las variables de entorno del scope _Production_ en Vercel) y,
opcionalmente, en un `.env.production.local` local (no versionado) para
poder probar un build de producción en tu máquina — ver
`.env.production.local.example`. Los _Preview deployments_ del hosting se
quedan apuntando a desarrollo.

El esquema, las políticas RLS y el catálogo (`games`) están versionados en
`supabase/migrations/`. El runbook para aplicarlos a producción, junto con
el checklist manual de Auth/SMTP/backups que no se puede migrar por SQL,
está en `supabase/RUNBOOK-produccion.md`.

## Commands

- `npm run dev` — start the dev server (also re-adds the agent-rules block to `AGENTS.md`)
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

There is no test runner configured yet.
