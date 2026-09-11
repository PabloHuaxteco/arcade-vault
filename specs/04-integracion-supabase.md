# SPEC 04 — Integración base de Supabase

> **Estado:** Aprobado
> **Depende de:** Ninguna
> **Fecha:** 2026-09-10
> **Objetivo:** Añadir la conexión base con Supabase a la app Next.js —clientes de navegador y de servidor con `@supabase/ssr`, variables de entorno y una ruta temporal de verificación— sin autenticación real ni tablas.

---

## 1 — Por qué existe esta spec

Arcade Vault necesitará una base de datos y autenticación reales (perfiles, puntuaciones, ranking global). Antes de nada hace falta el cableado mínimo: instalar los paquetes de Supabase y crear los clientes de acceso, una sola vez y bien hechos, para que las specs siguientes (auth real, esquema de datos) construyan encima sin reescribir la conexión.

Esta spec se queda deliberadamente en el plumbing. No toca el login falso actual (`app/_components/auth-form.tsx`, `app/_components/session-provider.tsx`, `/entrar`, `lib/storage.ts`), que sigue funcionando con `localStorage` como hasta ahora. No crea tablas. No añade el refresco de sesión en `proxy.ts`. Cada una de esas piezas irá en su propia spec.

El único detalle no obvio es la versión de Next: este proyecto usa **Next.js 16**, donde el fichero `middleware.ts` se ha renombrado a `proxy.ts` (export `proxy`). Las guías públicas de `@supabase/ssr` todavía hablan de `middleware.ts`; aquí no aplica porque el refresco de sesión se aplaza, pero queda anotado para la spec de auth.

---

## 2 — Alcance

**Dentro:**

- Dependencias `@supabase/ssr` y `@supabase/supabase-js` añadidas a `dependencies` en `package.json` (y `package-lock.json`).
- `lib/supabase/client.ts`: cliente de navegador. Exporta `createClient()` que envuelve `createBrowserClient<Database>(url, publishableKey)` de `@supabase/ssr`, leyendo `process.env.NEXT_PUBLIC_SUPABASE_URL` y `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Para usar desde componentes con `"use client"`.
- `lib/supabase/server.ts`: cliente de servidor. Exporta `async function createClient()` que llama a `cookies()` de `next/headers` (es asíncrono en Next 16) y monta `createServerClient<Database>(url, publishableKey, { cookies: { getAll, setAll } })`. El `setAll` se envuelve en `try/catch` porque escribir cookies desde un Server Component lanza; el comentario del catch explica que es esperado y que el refresco real llegará con `proxy.ts` en la spec de auth. Para usar desde Server Components, Server Actions y Route Handlers.
- `lib/supabase/types.ts`: tipo `Database` escrito a mano como placeholder vacío (`export type Database = { public: { Tables: Record<string, never>; Views: Record<string, never>; Functions: Record<string, never> } }` o equivalente mínimo). Da tipado al genérico de los clientes hasta que la spec del esquema lo sustituya por tipos generados (`supabase gen types`).
- `app/debug/supabase/page.tsx`: Server Component temporal de verificación. Crea el cliente de servidor, llama a `supabase.auth.getClaims()` y renderiza:
  - `CONECTADO` (con la URL del proyecto, sin claves) si la llamada no lanza.
  - `SIN CONFIGURAR` si falta `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - `ERROR` con el mensaje si la llamada falla por otra razón.
  - Marcado en un comentario del fichero como borrable: lo elimina la spec que introduzca datos reales.
- `.env.example` ampliado con `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, con comentario de dónde sacarlos (panel de Supabase → Project Settings → API Keys). Se conserva `SUPABASE_DB_PASSWORD=` tal cual.
- Sección nueva en `README.md` que documenta las dos variables `NEXT_PUBLIC_SUPABASE_*` y recuerda copiarlas a `.env.local`.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Autenticación real. El login falso (`auth-form.tsx`, `session-provider.tsx`, `/entrar`, `lib/storage.ts` con las claves `av_user` / `av_scores`) se mantiene intacto y no se conecta a Supabase Auth.
- `proxy.ts` en la raíz + helper `lib/supabase/proxy.ts` (`updateSession`) para refrescar el token en cada request. Va en la spec de auth.
- Clave secreta de servidor (`sb_secret_…` / `SUPABASE_SECRET_KEY`). Esta spec solo usa la publishable key. Se añadirá si alguna spec necesita saltarse RLS desde el servidor.
- Cualquier tabla, migración, política RLS o `supabase/` de la CLI (`supabase init`, `config.toml`, `migrations/`).
- Tipos TypeScript generados desde el esquema (`supabase gen types` → `lib/supabase/types.ts`). Aquí el tipo `Database` es un placeholder a mano.
- Traer la URL y las claves del proyecto por el MCP de Supabase o dejar `.env.local` relleno: la spec solo aporta la plantilla `.env.example`; los valores reales los pone la persona.
- Realtime, Storage, Edge Functions.
- Migrar `lib/games.ts` o `lib/leaderboard.ts` a Supabase.

---

## 3 — Modelo de datos

Esta feature no introduce estructuras de datos ni tablas. El tipo `Database` de `lib/supabase/types.ts` es un placeholder vacío que se sustituirá por tipos generados cuando exista esquema.

Variables de entorno nuevas (en `.env.local`, no versionado; plantilla en `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL                # https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY    # clave sb_publishable_… (Project Settings → API Keys)
```

Ficheros nuevos:

```
lib/supabase/client.ts      # createClient() para navegador  (createBrowserClient)
lib/supabase/server.ts      # async createClient() para servidor (createServerClient + cookies())
lib/supabase/types.ts       # type Database (placeholder vacío)
app/debug/supabase/page.tsx # ruta temporal de verificación de conexión
```

Convenciones:

- Ambos módulos exportan una función llamada `createClient` (no una instancia suelta): en `@supabase/ssr` el cliente se crea por request, no se comparte como singleton.
- El proyecto referencia el `project_ref` `mohwuulzonfjtqhkejko` (ya presente en `.mcp.json`); la URL de `.env.local` debe corresponder a ese proyecto.
- Se usan las **nuevas claves** de Supabase: `publishable` (pública, va con prefijo `NEXT_PUBLIC_`) en lugar de la legacy `anon`. No se usa `service_role` ni `secret`.
- La ruta de depuración vive bajo `app/debug/` para dejar claro que no es parte de la app y que se borrará.

---

## 4 — Plan de implementación

1. **Dependencias y variables de entorno.** `npm install @supabase/ssr @supabase/supabase-js`. Añadir a `.env.example` las líneas `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` con un comentario de origen. Añadir a `README.md` la nota de copiarlas a `.env.local`. Verificación: `npm run build` sigue en verde; ambos paquetes aparecen en `package.json`.
2. **Tipo placeholder.** Crear `lib/supabase/types.ts` con `export type Database` mínimo (public.Tables/Views/Functions vacíos) y un comentario de que lo reemplazan los tipos generados en la spec del esquema. Verificación: `npx tsc --noEmit` compila.
3. **Cliente de navegador.** Crear `lib/supabase/client.ts` (`import "server-only"` NO; es para cliente): `export function createClient()` → `createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)`. Verificación: `npx tsc --noEmit` compila; el módulo no importa nada de `next/headers`.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts`: `export async function createClient()` que hace `const cookieStore = await cookies()` y devuelve `createServerClient<Database>(url, publishableKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => { try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Component: el refresco real vendrá con proxy.ts */ } } } })`. Verificación: `npx tsc --noEmit` compila.
5. **Ruta de verificación.** Crear `app/debug/supabase/page.tsx` (Server Component): comprobar que las dos env vars existen → si no, render `SIN CONFIGURAR`; si sí, `const supabase = await createClient()`, `await supabase.auth.getClaims()` dentro de `try/catch` → `CONECTADO` + `process.env.NEXT_PUBLIC_SUPABASE_URL` en caso bueno, `ERROR` + `err.message` en el `catch`. Markup sobrio, sin depender de clases de `globals.css`. Comentario al inicio: «Ruta temporal, la borra la spec del esquema.» Verificación: con `.env.local` sin las claves, `/debug/supabase` muestra `SIN CONFIGURAR`.
6. **Cierre.** Rellenar `.env.local` con la URL y la publishable key reales del proyecto `mohwuulzonfjtqhkejko`. Abrir `/debug/supabase` y comprobar que muestra `CONECTADO`. Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `@supabase/ssr` y `@supabase/supabase-js` figuran en `dependencies` de `package.json`.
- [ ] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y sigue conteniendo `SUPABASE_DB_PASSWORD`.
- [ ] `README.md` documenta las dos variables `NEXT_PUBLIC_SUPABASE_*` y que hay que copiarlas a `.env.local`.
- [ ] `lib/supabase/client.ts` exporta `createClient` y usa `createBrowserClient`; no importa `next/headers`.
- [ ] `lib/supabase/server.ts` exporta `async createClient`, hace `await cookies()` y pasa `getAll` / `setAll`; el `setAll` está envuelto en `try/catch`.
- [ ] `lib/supabase/types.ts` exporta un tipo `Database` y ambos clientes lo usan como genérico (`createBrowserClient<Database>` / `createServerClient<Database>`).
- [ ] Con `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ausentes, `/debug/supabase` muestra `SIN CONFIGURAR` y no lanza una excepción no controlada.
- [ ] Con ambas variables puestas a valores válidos del proyecto, `/debug/supabase` muestra `CONECTADO` y la URL del proyecto (nunca una clave).
- [ ] `app/_components/auth-form.tsx`, `app/_components/session-provider.tsx`, `lib/storage.ts` y `app/entrar/page.tsx` no se han modificado.
- [ ] No existe `proxy.ts` ni `middleware.ts` en el repo, ni una carpeta `supabase/` de la CLI, ni ninguna migración.
- [ ] El resto de rutas (`/`, `/biblioteca`, `/acerca`, `/salon`, `/juego/[id]`) siguen renderizando igual que antes.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** `@supabase/ssr` con dos módulos (`client.ts` de navegador y `server.ts` de servidor), cada uno exportando `createClient`. Es el patrón oficial para App Router y evita compartir un cliente entre requests.
- **No:** una única instancia de `createClient` de `@supabase/supabase-js` compartida. No gestiona cookies de sesión ni SSR; rompería en cuanto llegue la auth.
- **Sí:** claves nuevas `publishable` (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Es el esquema de claves vigente de Supabase; las legacy `anon` / `service_role` están en proceso de deprecación.
- **No:** clave `secret` / `service_role` en esta spec. No hay servidor que necesite saltarse RLS todavía; añadirla ahora es superficie de riesgo sin uso.
- **Sí:** mantener el login falso (`localStorage`, claves `av_user` / `av_scores`) intacto y separado. Sustituirlo es una feature con su propia UX y merece su spec; mezclarlo aquí ampliaría el alcance a 3+ áreas.
- **No:** conectar `auth-form.tsx` a Supabase Auth en esta spec. Requiere decidir proveedores (email, OAuth), callbacks, `proxy.ts` y migración de la sesión actual.
- **Sí:** aplazar `proxy.ts` (refresco del token en cada request) a la spec de auth. Sin sesión real no refresca nada; añadirlo vacío solo confunde. Se documenta que en Next 16 el fichero es `proxy.ts` con export `proxy`, no `middleware.ts`.
- **Sí:** tipo `Database` placeholder escrito a mano. Da tipado a los genéricos sin depender de un esquema que aún no existe; la spec del esquema lo reemplaza por `supabase gen types`.
- **No:** generar tipos por el MCP ahora. Sin tablas propias el resultado es casi vacío y habría que regenerarlo igualmente.
- **Sí:** ruta temporal `app/debug/supabase/page.tsx` con `auth.getClaims()` como prueba de conexión. Se ve de un vistazo en el navegador y no necesita tablas; marcada como borrable.
- **No:** script de Node en `scripts/`. El proyecto no tiene runner ni carpeta `scripts/`; una ruta encaja mejor con el resto de specs.
- **No:** verificar solo con `build` + `lint`. Comprueba que compila pero no que las credenciales conectan, que es el punto de la spec.
- **Sí:** solo plantilla en `.env.example`, sin tocar el proyecto Supabase ni rellenar `.env.local` automáticamente. Mantiene la spec sin efectos secundarios sobre infraestructura externa.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                           | Mitigación                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La publishable key acaba en el bundle del cliente.                                                               | Es correcto: la clave `publishable` es pública por diseño y lleva prefijo `NEXT_PUBLIC_`. La seguridad real la da RLS, que llega con el esquema. Ninguna clave `secret` entra en esta spec.    |
| `cookies()` es asíncrono en Next 16 y las guías de Supabase muestran la versión síncrona.                        | `lib/supabase/server.ts` hace `await cookies()` y `createClient` se declara `async`; los consumidores hacen `await createClient()`. Recogido en el plan (paso 4) y en criterios de aceptación. |
| Escribir cookies desde un Server Component (el `/debug/supabase`) lanza una excepción.                           | El `setAll` del cliente de servidor va en `try/catch` con comentario de que es esperado sin `proxy.ts`; la ruta de debug solo lee (`getClaims`), no fuerza escritura.                          |
| Alguien asume que esta spec ya da login y borra el `session-provider` falso.                                     | El alcance, las decisiones y un criterio de aceptación dicen explícitamente que el login falso no se toca.                                                                                     |
| `@supabase/ssr` cambia de API respecto a lo conocido (nombres `getAll` / `setAll`, no `get` / `set` / `remove`). | Antes de implementar, revisar la versión instalada de `@supabase/ssr` en `node_modules` y su README; el plan fija la firma `{ cookies: { getAll, setAll } }`.                                  |
| La URL de `.env.local` no corresponde al `project_ref` de `.mcp.json`.                                           | El paso 6 indica usar el proyecto `mohwuulzonfjtqhkejko`; `/debug/supabase` muestra la URL activa para cotejarla.                                                                              |

---

## Lo que **no** entra en esta spec

- Autenticación real ni conexión del login falso a Supabase Auth.
- `proxy.ts` / `middleware.ts` para refrescar la sesión.
- Clave `secret` / `service_role` de servidor.
- Tablas, migraciones, políticas RLS y carpeta `supabase/` de la CLI.
- Tipos TypeScript generados desde el esquema.
- Rellenar `.env.local` automáticamente o tocar el proyecto Supabase por el MCP.
- Realtime, Storage, Edge Functions.
- Migrar `lib/games.ts` o `lib/leaderboard.ts` a la base de datos.

Cada uno de esos puntos, si llega, va en su propia spec.
