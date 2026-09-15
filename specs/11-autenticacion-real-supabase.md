# SPEC 11 — Autenticación real con Supabase Auth

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 06
> **Fecha:** 2026-09-15
> **Objetivo:** Reemplazar la sesión falsa de `localStorage` por registro, login (incluido Google/GitHub OAuth), cierre de sesión y recuperación de contraseña reales sobre `supabase.auth`, manteniendo intacta la pantalla `/entrar` existente y el modo invitado.

---

## 1 — Por qué existe esta spec

Desde el scaffold inicial, `/entrar` ya monta un formulario visual completo (`app/_components/auth-form.tsx`, portado de `references/templates/auth.jsx`), pero la autenticación es 100% falsa: `submit` acepta cualquier combinación de usuario/contraseña, y la "sesión" es solo un nombre guardado en `localStorage` (`lib/storage.ts`, clave `av_user`) sin contraseña ni verificación. CLAUDE.md documenta esto explícitamente ("Auth is still fake... there is no real Supabase auth yet").

SPEC 04 ya dejó los clientes de Supabase (`lib/supabase/client.ts` para navegador, `lib/supabase/server.ts` para servidor, ambos con `@supabase/ssr`). El propio `lib/supabase/server.ts` trae un comentario que anticipa esta spec: el refresco de sesión en cada request "llegará con `proxy.ts` en la spec de auth" — ese archivo (equivalente al `middleware.ts` de versiones anteriores de Next, renombrado en Next 16) no existe todavía.

El formulario de `/entrar` ya trae dos botones "O CONTINÚA CON" (GOOGLE/GITHUB) inertes desde el scaffold inicial — esta spec los conecta a `supabase.auth.signInWithOAuth` en vez de dejarlos decorativos, reutilizando el mismo `app/auth/callback/route.ts` que ya hace falta para confirmación de correo y recuperación de contraseña (OAuth también usa intercambio de código).

No se usa `/frontend-design`: `/entrar` ya existe y su estética encaja; esta spec cambia el motor detrás del formulario, no su diseño visual.

---

## 2 — Alcance

**Dentro:**

- `lib/supabase/client.ts`/`server.ts` (sin cambios de firma) se usan para todas las llamadas a `supabase.auth.*` de esta spec.
- **Registro** (`supabase.auth.signUp`) con correo + contraseña + nombre de jugador (guardado en `user_metadata.display_name`, no en una tabla nueva), con verificación por email obligatoria: tras un registro exitoso no hay sesión activa, se muestra una pantalla "revisa tu correo" en la propia `/entrar`.
- **Login** (`supabase.auth.signInWithPassword`) solo por correo + contraseña (sin login por nombre de usuario).
- **Cierre de sesión** (`supabase.auth.signOut`).
- **Recuperación de contraseña**: enlace "¿Olvidaste tu contraseña?" bajo el formulario de login que pide el correo (`supabase.auth.resetPasswordForEmail`) y una pantalla nueva `/entrar/restablecer` donde el usuario define una contraseña nueva (`supabase.auth.updateUser({ password })`) tras seguir el enlace del correo.
- **Callback de confirmación/recuperación**: `app/auth/callback/route.ts` (Route Handler), que intercambia el `code` de la URL por una sesión real (`exchangeCodeForSession`) y redirige a `/biblioteca` (confirmación de registro) o a `/entrar/restablecer` (recuperación de contraseña), según el parámetro `next`.
- **Refresco de sesión en cada request**: `proxy.ts` nuevo en la raíz del repo, siguiendo el patrón oficial de `@supabase/ssr` (llama a `supabase.auth.getUser()` y reenvía las cookies refrescadas), con `matcher` que excluye estáticos (`_next/static`, `_next/image`, `favicon.ico` y extensiones de imagen comunes).
- `app/_components/session-provider.tsx` se reescribe para hidratar `user` desde `supabase.auth.getSession()` y suscribirse a `onAuthStateChange`, en vez de leer `lib/storage.ts`. El shape expuesto para `user` se mantiene igual que hoy (`{ name: string } | null`, con `name` = `user_metadata.display_name`) para que **ningún consumidor existente** (`nav.tsx`, `game-player.tsx`, los 5 wrappers de juego) necesite cambios.
- `lib/storage.ts` pierde `StoredUser`/`readUser`/`writeUser`/`clearUser` (la parte de sesión falsa). `StoredScore`/`readScores`/`appendScore` no se tocan — los usa únicamente el reproductor decorativo `<GamePlayer>`, sin relación con esta spec.
- `app/_components/auth-form.tsx` se actualiza para llamar a las funciones reales del contexto de sesión: el tab INICIAR SESIÓN pide correo + contraseña; el tab CREAR CUENTA pide nombre de jugador + correo + contraseña. Errores de credenciales, correo ya registrado o contraseña débil se muestran inline con la clase `.contact-error` ya existente (creada en SPEC 03). El botón "JUGAR COMO INVITADO" sigue llamando `signOut()` y navegando a `/biblioteca` sin cambios de comportamiento.
- **Login social real** con Google y GitHub (`supabase.auth.signInWithOAuth({ provider: "google" | "github" })`). Los botones GOOGLE/GITHUB, ya presentes visualmente bajo "O CONTINÚA CON" en ambos tabs (INICIAR SESIÓN y CREAR CUENTA), pasan a disparar el flujo real — es la misma llamada para "entrar" que para "crear cuenta": si la cuenta de Google/GitHub no existe aún en `auth.users`, Supabase la crea automáticamente. Ambos providers deben habilitarse en el panel de Supabase Auth (Client ID/secret de la consola de Google Cloud y de GitHub OAuth Apps) — configuración manual documentada en el plan, no código.
- El `display_name` de una cuenta OAuth se toma del perfil que devuelve el proveedor (`full_name` de Google, `user_name`/`login` de GitHub, según venga en `user_metadata`), en mayúsculas y recortado a 10 caracteres — mismo límite que ya usan las cuentas por correo. Sin pantalla adicional para editarlo en esta spec.
- Las cuentas OAuth llegan con el correo ya verificado por el proveedor: no pasan por la pantalla "revisa tu correo", entran directo a `/biblioteca` tras el callback.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Vincular las puntuaciones (`scores.name`) a la cuenta autenticada con una columna `user_id`: los 5 modales de fin de juego siguen guardando el nombre que el jugador escribe en el input (hoy ya prellenado con `user.name`, sin cambios de código). Vincular el esquema de `scores` a `auth.users` queda para una spec futura dedicada a leaderboard.
- Otros proveedores OAuth (Discord, X, etc.) — solo Google y GitHub en esta spec.
- Fusión/vinculación explícita de cuentas cuando una cuenta por correo y una cuenta OAuth comparten el mismo email: se deja el comportamiento por defecto de Supabase Auth (configuración "Auto-link" del proyecto), sin lógica propia de detección o mensajes dedicados.
- Pantalla de "completa tu perfil" tras el primer login OAuth para elegir un nombre de jugador distinto al del proveedor.
- Rutas protegidas: ninguna ruta empieza a exigir sesión. `/biblioteca`, `/juego/[id]/jugar`, `/salon`, etc. siguen accesibles sin cuenta, igual que hoy.
- Tabla `public.profiles` u otro almacenamiento de perfil más allá de `user_metadata.display_name`.
- Cambiar el correo de una cuenta ya registrada, eliminar cuenta, o cualquier pantalla de "mi perfil".
- Roles o permisos (admin, moderador, etc.).
- Rate limiting propio sobre intentos de login/registro — se confía en los límites por defecto de Supabase Auth.
- Plantillas de email personalizadas de Supabase Auth (asunto/cuerpo de los correos de confirmación y recuperación); se usan las plantillas por defecto del proyecto.
- Tests automatizados (no hay runner configurado), i18n, rediseño visual de `/entrar`.

---

## 3 — Modelo de datos

Esta spec no crea tablas ni columnas nuevas en Supabase. Reutiliza `auth.users` (gestionada por Supabase Auth) y guarda el nombre de jugador en su `user_metadata`, no en una tabla `public.profiles`.

```ts
// app/_components/session-provider.tsx
interface SessionUser {
  name: string; // user_metadata.display_name, mayúsculas, máx. 10 caracteres — mismo shape que StoredUser hoy
}

interface SessionValue {
  user: SessionUser | null;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (
    provider: "google" | "github"
  ) => Promise<{ error: string | null }>;
}
```

Convenciones:

- `signUp` guarda `displayName` en `options.data.display_name` de `supabase.auth.signUp`, y pasa `options.emailRedirectTo` apuntando a `app/auth/callback/route.ts`. No inserta ninguna fila fuera de `auth.users`.
- `signInWithOAuth` pasa `options.redirectTo` apuntando también a `app/auth/callback/route.ts` (mismo Route Handler que confirmación de correo y recuperación de contraseña) y redirige el navegador entero a la URL de autorización del proveedor — no hay estado que gestionar en el cliente más allá de esa redirección.
- Para cuentas OAuth sin `display_name` propio, el callback (o un fallback en `session-provider.tsx` al hidratar `user`) deriva el nombre de `user_metadata.full_name` (Google) o `user_metadata.user_name`/`user_metadata.login` (GitHub), en mayúsculas y recortado a 10 caracteres — no se escribe nada nuevo en `user_metadata.display_name` para no interferir con cuentas que sí lo definieron por registro con correo.
- El shape de `user` (`{ name: string } | null`) es deliberadamente idéntico al `StoredUser` de hoy: es lo que permite que `nav.tsx`, `game-player.tsx` y los 5 wrappers de juego (que ya leen `user.name`) sigan funcionando sin ninguna modificación.
- `lib/storage.ts` conserva `StoredScore`/`readScores`/`appendScore` sin cambios; pierde `StoredUser`/`readUser`/`writeUser`/`clearUser`.
- `proxy.ts` no mantiene estado propio: solo reenvía las cookies que `@supabase/ssr` ya administra.

---

## 4 — Plan de implementación

1. **Callback y refresco de sesión.** Crear `app/auth/callback/route.ts` (Route Handler): lee `code` y `next` de la query string, llama `await supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor, y redirige a `next` (por defecto `/biblioteca`) o a `/entrar?error=confirmacion` si falla. Crear `proxy.ts` en la raíz del repo con la función `updateSession` del patrón oficial de `@supabase/ssr` (`supabase.auth.getUser()` + reenvío de cookies), con `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y extensiones estáticas comunes. Actualizar el comentario en `lib/supabase/server.ts` que anunciaba este paso. Verificación: `npx tsc --noEmit`; `npm run dev` sigue sirviendo todas las rutas existentes sin bucles de redirección ni errores en consola.
2. **Sesión real (`session-provider.tsx` + limpieza de `lib/storage.ts`).** Reescribir `app/_components/session-provider.tsx` para hidratar `user` desde `supabase.auth.getSession()` tras el montaje y suscribirse a `onAuthStateChange` (actualiza `user` en login/logout/refresh), exponiendo `signIn`/`signUp`/`signOut`/`requestPasswordReset`/`updatePassword`/`signInWithOAuth` como en la sección 3, con la derivación de `display_name` para cuentas OAuth descrita ahí. Quitar `StoredUser`/`readUser`/`writeUser`/`clearUser` de `lib/storage.ts`. Verificación: `npx tsc --noEmit` marca errores en `auth-form.tsx` (todavía llama a la firma vieja de `signIn`) — esperado, se corrige en el paso siguiente.
3. **Formulario real (`auth-form.tsx`).** INICIAR SESIÓN pasa a pedir correo + contraseña (el campo "Usuario" se renombra a "Correo electrónico", `type="email"`); CREAR CUENTA pide nombre de jugador (máx. 10, mayúsculas, mismo límite que hoy) + correo + contraseña. `submit` llama a `signIn`/`signUp` reales; los errores (credenciales inválidas, correo ya registrado, contraseña débil, error de red) se muestran con `.contact-error` bajo el formulario, sin navegar. Tras un `signUp` exitoso se muestra una pantalla "revisa tu correo" (reutilizando `.toast-saved`) con el correo introducido, en vez de redirigir a `/biblioteca`. Se añade un enlace "¿Olvidaste tu contraseña?" bajo el tab de login que despliega un mini-formulario de solo correo (`requestPasswordReset`) con su propio estado de confirmación ("revisa tu correo" también). El botón "JUGAR COMO INVITADO" no cambia. Verificación: `npx tsc --noEmit` en verde; en `/entrar`, crear una cuenta con un correo real muestra la pantalla "revisa tu correo" sin redirigir; iniciar sesión con credenciales incorrectas muestra el error inline sin navegar.
4. **OAuth (Google/GitHub).** Habilitar los providers Google y GitHub en el panel de Supabase Auth (Client ID/secret de la consola de Google Cloud y de una GitHub OAuth App, con la URL de callback de Supabase registrada en ambas consolas) — paso manual, sin código. Conectar los botones GOOGLE/GITHUB de `auth-form.tsx` (los mismos en ambos tabs) a `signInWithOAuth("google" | "github")`; cada botón deshabilita el resto del formulario mientras redirige. Verificación: pulsar GOOGLE o GITHUB desde `/entrar` redirige a la pantalla de consentimiento del proveedor; autorizar vuelve a `app/auth/callback/route.ts` y de ahí a `/biblioteca` con sesión activa; la Nav muestra el nombre derivado del proveedor.
5. **Restablecer contraseña.** Crear `app/entrar/restablecer/page.tsx` (Server Component) que monta `app/_components/reset-password-form.tsx` (`"use client"`): campos de contraseña nueva + confirmación, llama a `updatePassword` del contexto de sesión y redirige a `/biblioteca` al terminar. Verificación: seguir el enlace de recuperación recibido por correo abre `/auth/callback?...&next=/entrar/restablecer`, que redirige a `/entrar/restablecer` con una sesión temporal activa; cambiar la contraseña ahí y volver a iniciar sesión con la nueva contraseña funciona.
6. **Cierre.** `npm run lint` y `npm run build` en verde. Repaso manual: registrar una cuenta con un correo real, confirmar por el enlace del correo, verificar que `/biblioteca` queda con sesión activa (Nav muestra el nombre); cerrar sesión y volver a iniciar sesión con las mismas credenciales; entrar con Google y con GitHub por separado; probar "¿Olvidaste tu contraseña?" de punta a punta; confirmar que "JUGAR COMO INVITADO" sigue funcionando sin cuenta; jugar una partida en cualquiera de los 5 motores y comprobar que el modal de fin sigue prellenando las iniciales con el nombre de la cuenta, sin haber tocado esos wrappers.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `lib/storage.ts` ya no exporta `StoredUser`, `readUser`, `writeUser` ni `clearUser`; `StoredScore`/`readScores`/`appendScore` siguen intactos y solo los usa `<GamePlayer>`.
- [ ] Registrar una cuenta nueva con correo + contraseña + nombre de jugador crea un usuario real en `auth.users` con `user_metadata.display_name` igual al nombre introducido (verificable con `execute_sql` o el panel de Supabase Auth).
- [ ] Tras registrarse, `/entrar` muestra la pantalla "revisa tu correo" y **no** navega a `/biblioteca`; no hay sesión activa hasta confirmar el enlace del correo.
- [ ] Seguir el enlace de confirmación del correo aterriza en `/biblioteca` con sesión activa (la Nav muestra el nombre de jugador en vez de "Iniciar Sesión").
- [ ] Iniciar sesión con correo/contraseña correctos navega a `/biblioteca` con sesión activa.
- [ ] Iniciar sesión con una contraseña incorrecta muestra un error inline con `.contact-error` y no navega.
- [ ] Intentar iniciar sesión con una cuenta que aún no confirmó su correo muestra un error inline explicando que falta confirmar, sin crear una sesión.
- [ ] El botón/enlace "¿Olvidaste tu contraseña?" pide un correo, dispara `resetPasswordForEmail` y muestra su propia pantalla de confirmación.
- [ ] Seguir el enlace de recuperación del correo aterriza en `/entrar/restablecer`; introducir una contraseña nueva y confirmarla actualiza la contraseña y redirige a `/biblioteca`.
- [ ] Iniciar sesión después con la contraseña nueva (y ya no con la anterior) funciona.
- [ ] Pulsar el botón GOOGLE en `/entrar` (cualquiera de los dos tabs) redirige a la pantalla de consentimiento de Google; autorizar vuelve a `/biblioteca` con sesión activa y la Nav muestra un nombre derivado del perfil de Google.
- [ ] Pulsar el botón GITHUB en `/entrar` (cualquiera de los dos tabs) redirige a la pantalla de consentimiento de GitHub; autorizar vuelve a `/biblioteca` con sesión activa y la Nav muestra un nombre derivado del perfil de GitHub.
- [ ] Una cuenta creada por Google o GitHub no pasa por la pantalla "revisa tu correo": entra directo a `/biblioteca` tras autorizar.
- [ ] El botón con el nombre de usuario en la Nav sigue cerrando la sesión al pulsarlo (`signOut()` real) y vuelve a mostrar "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" sigue navegando a `/biblioteca` sin sesión activa, igual que hoy.
- [ ] Ninguno de los 5 wrappers de juego (`asteroids-game.tsx`, `tetris-game.tsx`, `arkanoid-game.tsx`, `snake-game.tsx`, `frogger-game.tsx`), `game-player.tsx` ni `nav.tsx` cambia de código en esta spec — siguen leyendo `user.name` del mismo shape.
- [ ] Al terminar una partida con sesión activa, el input de iniciales del modal de fin sigue prellenado con el nombre de la cuenta (comportamiento ya existente, sin regresión).
- [ ] `proxy.ts` existe en la raíz del repo y refresca la sesión: recargar por completo una página protegida por sesión (`F5`) después de varios minutos no cierra la sesión de forma inesperada.
- [ ] Recargar la app (F5) en cualquier ruta pública sin sesión no produce ningún error de consola ni redirección inesperada.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** Supabase Auth real (`signUp`/`signInWithPassword`/`signOut`/`resetPasswordForEmail`/`updateUser`) en vez de la sesión falsa de `localStorage`. Es el único camino coherente con que la plataforma ya usa Supabase para catálogo y leaderboard (SPEC 04/06) y con que CLAUDE.md marcaba explícitamente el auth falso como pendiente.
- **No:** mantener la sesión falsa con solo una mejora visual de validaciones. Habría dejado la plataforma sin autenticación real, que es justo lo que se pidió.
- **Sí:** verificación de correo obligatoria antes de dar acceso (pantalla "revisa tu correo", sin sesión hasta confirmar). Es el flujo estándar y más seguro de Supabase Auth; evita cuentas con correos falsos o ajenos.
- **No:** dar acceso inmediato tras `signUp` sin esperar confirmación. Se descartó por seguridad, aunque técnicamente Supabase lo permite según configuración del proyecto.
- **Sí:** nombre de jugador guardado en `user_metadata.display_name` de `auth.users`, sin tabla `public.profiles` nueva. Supabase Auth no tiene un campo de username nativo, y una tabla de perfiles habría añadido esquema + políticas RLS sin necesidad real para esta spec (no hay unicidad de nombre ni columnas de perfil adicionales que la justifiquen).
- **No:** tabla `public.profiles`. Se deja como opción para una spec futura si aparece una necesidad real (unicidad de nombre, avatar, bio, etc.).
- **Sí:** login solo por correo + contraseña, sin permitir login por nombre de usuario. Es el flujo nativo de `signInWithPassword` sin trabajo adicional; el nombre de jugador queda solo como texto para mostrar (HUD, Nav, salón), no como credencial.
- **No:** login por username. Habría requerido una tabla de mapeo username→correo y una consulta extra antes de autenticar, sin que el usuario lo pidiera explícitamente.
- **Sí:** mantener el shape `user: { name: string } | null` idéntico al `StoredUser` actual. Es la decisión que evita tocar `nav.tsx`, `game-player.tsx` y los 5 wrappers de juego — todos ya leen `user.name`, y ese campo ahora viene de `user_metadata.display_name` en vez de `localStorage`, sin que esos componentes lo noten.
- **No:** expandir el contexto de sesión con `email`, `id` u otros campos de `auth.users` "porque podrían servir después". Nada en el alcance de esta spec los necesita; añadirlos ahora sería especular sobre una spec futura (la de vincular `scores.user_id`).
- **Sí:** vincular las puntuaciones a la cuenta autenticada (`scores.user_id`, tocar los 5 modales) queda fuera de esta spec, aunque se preguntó explícitamente por ello. El input de iniciales ya se prellena con `user.name` sin ningún cambio de código — es scope suficiente para esta spec de autenticación; la vinculación real de esquema es un cambio de otra capa (leaderboard).
- **Sí:** recuperación de contraseña (`/entrar/restablecer` + `resetPasswordForEmail`/`updateUser`) incluida en esta spec, aunque inicialmente se había propuesto dejarla fuera. El usuario prefirió cerrarla ahora en vez de dejar el flujo de auth incompleto.
- **Sí:** `proxy.ts` nuevo en esta spec, siguiendo el patrón oficial de `@supabase/ssr` para refrescar la sesión en cada request. El propio código ya lo anticipaba (comentario en `lib/supabase/server.ts`); dejarlo fuera habría dejado sesiones caducando de forma inconsistente entre Server Components.
- **No:** dejar el refresco de sesión sin resolver como riesgo aceptado. El comentario preexistente en el código ya señalaba que este era el momento de resolverlo.
- **Sí:** ninguna ruta pasa a requerir sesión obligatoria. Esta spec cambia CÓMO se autentica, no QUÉ requiere estar autenticado — mantiene `/biblioteca`, `/juego/[id]/jugar`, `/salon`, etc. accesibles sin cuenta, igual que hoy con el modo invitado.
- **No:** proteger alguna ruta específica (por ejemplo, exigir sesión para guardar puntuación). Se descartó para no mezclar una decisión de autorización con esta spec, centrada en autenticación.
- **Sí:** mantener el botón "JUGAR COMO INVITADO" sin cambios de comportamiento. El usuario confirmó que el modo invitado sigue existiendo.
- **Sí:** login social real con Google y GitHub (`signInWithOAuth`) incluido en esta spec. El usuario pidió expresamente sumarlo tras la primera versión de la spec; reutiliza el mismo `app/auth/callback/route.ts` que ya existía para confirmación de correo y recuperación de contraseña, sin infraestructura nueva.
- **No:** otros proveedores OAuth (Discord, X, Apple, etc.). Fuera de lo pedido; se pueden sumar en una spec futura repitiendo el mismo patrón.
- **Sí:** un solo par de botones GOOGLE/GITHUB, activo en ambos tabs (INICIAR SESIÓN y CREAR CUENTA), con la misma llamada `signInWithOAuth` para ambos casos. Con OAuth no existe una distinción real entre "iniciar sesión" y "crear cuenta" — Supabase crea la cuenta automáticamente si no existía, así que separar los botones por tab habría sido una distinción sin efecto práctico.
- **No:** botones OAuth solo en el tab de login. Se descartó porque habría sido una limitación artificial sin beneficio, dado que la llamada subyacente es idéntica.
- **Sí:** el `display_name` de una cuenta OAuth se deriva automáticamente del perfil del proveedor (`full_name` de Google, `user_name`/`login` de GitHub), sin pantalla adicional para editarlo. Mantiene el flujo OAuth en un solo paso (clic → consentimiento → sesión activa), coherente con la expectativa estándar de "login social" como acceso inmediato.
- **No:** una pantalla de "completa tu perfil" tras el primer login OAuth para elegir nombre de jugador. Habría añadido una pantalla y un estado nuevo sin que el usuario lo pidiera; queda como posible mejora futura si el nombre derivado del proveedor resulta insatisfactorio en la práctica.
- **Sí:** dejar el comportamiento por defecto de Supabase Auth para el caso de una cuenta por correo y una cuenta OAuth que comparten el mismo email (sin lógica propia de vinculación o mensajes dedicados). Implementar detección y fusión de cuentas es un problema no trivial que el usuario no pidió resolver de forma custom; se documenta como riesgo aceptado en la sección 7.
- **No:** lógica propia para detectar y bloquear/fusionar cuentas duplicadas por email. Se descartó por alcance — depende de la configuración "Auto-link" del panel de Supabase, fuera de esta spec.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                                         | Mitigación                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El "Site URL" y las "Redirect URLs" del proyecto de Supabase (panel de Auth) no incluyen el origen usado en desarrollo/producción — el enlace del correo redirige a una URL no permitida y Supabase rechaza el intercambio de código.                                                          | Es una configuración del panel de Supabase, no de código; se documenta como paso manual explícito en el plan de implementación (paso 1) antes de probar el flujo end-to-end.                                                                     |
| El límite por defecto de envío de correos de Supabase Auth (SMTP compartido del proyecto) es bajo y puede bloquear pruebas repetidas de registro/recuperación.                                                                                                                                 | Aceptado como limitación conocida de desarrollo; si se vuelve bloqueante, configurar un proveedor SMTP propio queda fuera de esta spec.                                                                                                          |
| `proxy.ts` corre en **todas** las rutas si el `matcher` está mal definido, afectando el rendimiento de assets estáticos o rompiendo `_next/static`.                                                                                                                                            | El `matcher` del paso 1 excluye explícitamente `_next/static`, `_next/image`, `favicon.ico` y extensiones estáticas comunes, siguiendo el ejemplo oficial de `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. |
| Cambiar el shape de `SessionValue` (nuevas firmas async de `signIn`/`signOut`) sin mantener `user: { name } \| null` rompería silenciosamente los 5 wrappers de juego y `nav.tsx`, que no se tocan en esta spec.                                                                               | El shape de `user` se mantiene idéntico a `StoredUser` a propósito (ver sección 6); se verifica manualmente en el paso 6 que ninguno de esos componentes necesitó cambios.                                                                       |
| Un usuario cierra la pestaña entre `signUp` y la confirmación del correo, y vuelve más tarde sin recordar que ya se registró; un segundo `signUp` con el mismo correo puede confundir el mensaje de error.                                                                                     | Supabase Auth devuelve un error identificable para "correo ya registrado"; el formulario lo muestra igual que cualquier otro error de `.contact-error`, sin lógica especial adicional en esta spec.                                              |
| Las URLs de callback registradas en la consola de Google Cloud y en la GitHub OAuth App no coinciden exactamente con la URL de callback que expone el proyecto de Supabase — el proveedor rechaza la autorización antes de volver a la app.                                                    | Configuración manual documentada explícitamente en el paso 4 del plan; se verifica probando el flujo completo con cada proveedor antes de cerrar la spec.                                                                                        |
| Una cuenta creada por correo/contraseña y una cuenta OAuth (Google o GitHub) comparten el mismo email: según la configuración "Auto-link" del proyecto, Supabase puede fusionarlas, crear una cuenta separada, o rechazar el login, sin que esta spec defina un mensaje propio para cada caso. | Aceptado como riesgo (ver decisión en sección 6): se deja el comportamiento por defecto de Supabase; si en la práctica confunde a los jugadores, se resuelve en una spec futura con lógica de vinculación dedicada.                              |
| El nombre derivado de GitHub (`user_name`/`login`) o de Google (`full_name`) puede venir vacío, con caracteres no permitidos, o más largo que 10 caracteres antes de truncar, dejando un `display_name` poco legible en la Nav/HUD.                                                            | Se sanea igual que el nombre de las cuentas por correo (mayúsculas, recorte a 10 caracteres); si el proveedor no entrega ningún nombre utilizable, se usa un valor por defecto (p. ej. `"JUGADOR"`), sin bloquear el login.                      |

---

## Lo que **no** entra en esta spec

- Vincular `scores.name` a la cuenta autenticada (`scores.user_id`), tocar los 5 modales de fin de juego para eso, o cambiar `/salon`.
- Otros proveedores OAuth además de Google y GitHub (Discord, X, Apple, etc.).
- Pantalla de "completa tu perfil" para editar el nombre derivado de una cuenta OAuth, o lógica propia de vinculación/fusión de cuentas duplicadas por email.
- Rutas protegidas por sesión.
- Tabla `public.profiles` o cualquier dato de perfil más allá de `user_metadata.display_name`.
- Cambiar correo, eliminar cuenta, roles/permisos, rate limiting propio.
- Plantillas de correo personalizadas de Supabase Auth.
- Tests automatizados, i18n, rediseño visual de `/entrar`.

Cada uno de esos puntos, si llega, va en su propia spec.
