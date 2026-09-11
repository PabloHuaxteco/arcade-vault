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

## Commands

- `npm run dev` — start the dev server (also re-adds the agent-rules block to `AGENTS.md`)
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

There is no test runner configured yet.
