# SPEC 12 — Medidas de seguridad básicas

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 06, SPEC 11
> **Fecha:** 2026-09-17
> **Objetivo:** Aplicar el checklist básico de seguridad de `references/security/security-checklist.md` — endurecer la política de `INSERT` en `scores` exigiendo sesión real, políticas de contraseña/anti-bot de Supabase Auth, y headers HTTP de seguridad en Next.js.

---

## 1 — Por qué existe esta spec

`references/security/security-checklist.md` recoge dos fuentes: un checklist manual de 5 puntos y el resultado de los advisors de seguridad de Supabase sobre el proyecto real. Dos de esos puntos apuntan al mismo problema: la política `anyone can insert a score` de `public.scores` (creada en SPEC 06, cuando el login todavía era falso) usa `WITH CHECK (true)` — cualquiera, sin sesión, puede insertar cualquier fila. El advisor `rls_policy_always_true` lo marca como WARN.

Ahora que SPEC 11 ya dejó autenticación real con Supabase Auth funcionando, esta spec cierra ese hueco exigiendo sesión real para guardar puntuación, y de paso suma la columna `scores.user_id` para vincular cada puntuación a la cuenta que la guardó — algo que SPEC 11 había dejado fuera de su alcance explícitamente, pero que se vuelve necesario aquí para que el bloque "▸ TU MEJOR MARCA" de `/salon` deje de depender de una coincidencia de texto por nombre (poco confiable: dos jugadores pueden compartir iniciales) y compare por identidad real.

El resto del checklist (longitud mínima de contraseña, protección de contraseñas filtradas, límite de registros por IP, headers HTTP) no depende de ese cambio y se resuelve en paralelo: los tres primeros son configuración del panel de Supabase Auth, no código; los headers son una única entrada en `next.config.ts`.

---

## 2 — Alcance

**Dentro:**

- Migración SQL que agrega `public.scores.user_id` (uuid, nullable, referencia a `auth.users.id`, con default `auth.uid()`) y reemplaza la política `anyone can insert a score` por una que exige `auth.uid() is not null and user_id = auth.uid()`.
- `lib/scores.ts`: `getTopScores`/`getTopScoresByGames` seleccionan también `user_id`; `ScoreRow` gana el campo `userId: string | null`.
- `lib/scores-client.ts`: sin cambios de firma — `insertScore` no envía `user_id`, lo rellena el default de la columna a partir de la sesión activa en Supabase.
- `app/_components/session-provider.tsx`: `SessionUser` gana `id: string` (`auth.users.id`), además del `name` que ya expone hoy.
- `app/_components/hall-of-fame.tsx`: el bloque "▸ TU MEJOR MARCA" pasa a comparar `user.id === row.userId` en vez de comparar nombres; sin sesión, el bloque no se muestra (igual que hoy).
- Los 5 wrappers de juego (`asteroids-game.tsx`, `tetris-game.tsx`, `arkanoid-game.tsx`, `snake-game.tsx`, `frogger-game.tsx`): cuando no hay sesión activa (`user === null`), la pantalla de fin de partida muestra un aviso ("inicia sesión para guardar tu puntuación", con enlace a `/entrar`) en vez del formulario de iniciales + botón GUARDAR PUNTUACIÓN. Con sesión, el flujo de guardado no cambia para quien juega.
- `next.config.ts`: función `headers()` que aplica `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` a todas las rutas (`source: "/(.*)"`), tal como lo describe el checklist.
- Configuración manual en el panel de Supabase Auth (Authentication → políticas de contraseña / rate limits), documentada como pasos explícitos del plan: longitud mínima de contraseña de 8 caracteres, protección de contraseñas filtradas (HaveIBeenPwned) activada, límite de registros por IP activado. Se intenta primero vía el MCP de Supabase (si expone alguna vía de Management API para esto); si no, queda como paso manual verificado.
- Protección de rutas con proxy Next.js: información sobre proxy aquí:
  https://nextjs.org/docs/app/getting-started/proxy
  Ejemplo: proxy.ts

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/home", request.url));
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: "/about/:path*",
};
```

- `npm run lint` y `npm run build` pasan sin errores.
- `get_advisors` (categoría seguridad) ya no reporta el WARN `rls_policy_always_true` sobre `public.scores` al cerrar la spec.

**Fuera de alcance (para futuras specs):**

- Vincular las ~96 filas semilla de `scores` (SPEC 06) a cuentas reales. Quedan con `user_id = NULL`, siguen apareciendo en el leaderboard igual que hoy, simplemente no participan del bloque "TÚ".
- Cualquier pantalla de perfil, historial de partidas por cuenta, o mostrar el `user_id` en la UI más allá del match interno de "TÚ".
- `Strict-Transport-Security` o `Content-Security-Policy`. Se dejan fuera para no arriesgar romper OAuth (Google/GitHub), Supabase o `next/font` sin una revisión dedicada.
- Rate limiting propio a nivel de aplicación (además del de Supabase Auth) para signup o para el propio INSERT de `scores`.
- Moderación de nombres ofensivos en `scores.name` o `user_metadata.display_name`.
- Plantillas de correo, roles/permisos, o cualquier otro punto no listado en `references/security/security-checklist.md`.
- Tests automatizados (no hay runner configurado en el repo).

---

## 3 — Modelo de datos

### Cambio de esquema en Supabase

```sql
alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null default auth.uid();

drop policy "anyone can insert a score" on public.scores;

create policy "authenticated users can insert their own score"
  on public.scores
  for insert
  with check (auth.uid() is not null and user_id = auth.uid());
```

### Tipos TypeScript

```ts
// lib/scores.ts
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
  userId: string | null; // null en filas semilla sin cuenta real (SPEC 06)
}
```

```ts
// app/_components/session-provider.tsx
interface SessionUser {
  id: string; // auth.users.id — usado para el match "TÚ" en /salon
  name: string; // user_metadata.display_name, mayúsculas, máx. 10 caracteres
}
```

Convenciones:

- El default `auth.uid()` en la columna se resuelve en el momento del `INSERT`, antes de evaluar el `WITH CHECK` de la política — por eso `insertScore()` no necesita enviar `user_id` explícitamente y `user_id = auth.uid()` en la política sigue siendo una comprobación válida (no se puede forjar `user_id` de otro usuario porque el default lo sobrescribiría de todas formas si el cliente lo omite, y si lo envía explícito con un valor distinto, el `WITH CHECK` lo rechaza).
- `on delete set null`: si una cuenta se elimina en el futuro (fuera de alcance hoy, no hay pantalla para ello), sus puntuaciones pasadas no desaparecen del leaderboard, solo pierden el vínculo.
- `hall-of-fame.tsx` sigue recibiendo `scoresByGame: Record<string, ScoreRow[]>` por props sin cambios de forma en el componente padre (`app/salon/page.tsx`); solo cambia qué campo usa internamente para el match "TÚ".

---

## 4 — Plan de implementación

1. **Migración SQL.** `apply_migration` con el SQL de la sección 3: agrega `scores.user_id` y reemplaza la política de `INSERT`. Verificación: `list_tables` muestra la columna nueva; `execute_sql` con un `INSERT` de prueba sin sesión (rol `anon`) falla por RLS; un `INSERT` simulando un `auth.uid()` válido con `user_id` distinto también falla.
2. **`lib/scores.ts`.** Añadir `user_id` al `select` de `getTopScores`/`getTopScoresByGames` y `userId` a `ScoreRow`. Verificación: `npx tsc --noEmit` compila.
3. **`session-provider.tsx`.** Añadir `id: string` a `SessionUser`, derivado de `user.id` en `toSessionUser`. Verificación: `npx tsc --noEmit` marca el uso de `user.id` en `hall-of-fame.tsx` (paso siguiente) como pendiente hasta escribirlo; los consumidores existentes que solo leen `user.name` (Nav, 5 wrappers, `game-player.tsx`) no cambian.
4. **`hall-of-fame.tsx`.** Cambiar el cálculo de `youRow` de comparar `r.name.toLowerCase() === user.name.toLowerCase()` a `r.userId === user.id`. Verificación manual: con sesión activa y una puntuación guardada por esa cuenta, el bloque "TÚ" aparece en `/salon`; sin sesión, no aparece.
5. **Los 5 wrappers de juego.** En el bloque de fin de partida (formulario de iniciales + botón GUARDAR PUNTUACIÓN, idéntico en los 5), envolver ese formulario en `user ? (...) : (<aviso con enlace a /entrar>)`. Verificación manual: terminar una partida sin sesión en cualquiera de los 5 juegos muestra el aviso, no el formulario; terminarla con sesión activa guarda la puntuación normalmente y la fila nueva en Supabase trae `user_id` igual al id de la cuenta.
6. **Headers de seguridad.** Añadir `headers()` a `next.config.ts` con los 3 headers de la sección 2. Verificación: `npm run dev`, inspeccionar la pestaña Network del navegador en cualquier ruta y confirmar que las respuestas incluyen `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
7. **Configuración de Supabase Auth.** En el panel del proyecto (Authentication → Policies / Auth settings): fijar longitud mínima de contraseña en 8, activar "Leaked password protection", activar/ajustar el límite de registros por IP. Revisar primero si el MCP de Supabase expone alguna vía de Management API para aplicar esto sin pasar por el dashboard; si no la expone, es un paso manual. Verificación: intentar `signUp` con una contraseña de menos de 8 caracteres o una contraseña filtrada conocida (`Password123`) es rechazado por Supabase Auth con un error visible en `/entrar`.
8. Protección de rutas con Proxy Next.js
9. **Cierre.** `npm run lint` y `npm run build` en verde. `get_advisors` (categoría seguridad) ya no reporta `rls_policy_always_true` sobre `public.scores`; revisar si sigue reportando `auth_leaked_password_protection` (debería desaparecer tras el paso 7).

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `public.scores` tiene la columna `user_id` (uuid, nullable, FK a `auth.users.id`).
- [ ] Un `INSERT` en `scores` sin sesión activa (rol `anon`) falla por RLS.
- [ ] Un `INSERT` en `scores` con sesión activa y sin especificar `user_id` en el payload funciona y la fila resultante trae `user_id` igual al id de esa cuenta.
- [ ] Un `INSERT` en `scores` con sesión activa que intenta forzar un `user_id` distinto al de la cuenta autenticada falla por RLS.
- [ ] Terminar una partida sin sesión activa en cualquiera de los 5 juegos muestra un aviso para iniciar sesión, no el formulario de guardar puntuación.
- [ ] Terminar una partida con sesión activa guarda la puntuación con el flujo actual, sin pedir nada adicional al jugador.
- [ ] `/salon` muestra el bloque "▸ TU MEJOR MARCA" cuando la cuenta activa tiene una fila propia (`userId` coincide) entre las cargadas para el juego activo, y no lo muestra si no hay coincidencia o no hay sesión.
- [ ] Las filas semilla de `scores` (SPEC 06, `user_id = NULL`) siguen apareciendo en el leaderboard de `/salon` sin errores.
- [ ] `next.config.ts` aplica `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` a todas las rutas (verificable en la pestaña Network del navegador).
- [ ] Registrar una cuenta nueva con una contraseña de menos de 8 caracteres es rechazado por Supabase Auth con un error visible en `/entrar`.
- [ ] ⏸️ **Diferido.** Registrar una cuenta nueva con una contraseña filtrada conocida (por ejemplo `Password123`) es rechazado por la protección de contraseñas filtradas. — "Leaked password protection" es una función de Supabase Auth que requiere un plan de pago; el proyecto sigue en el plan gratuito al cerrar esta spec. Se activará manualmente en el panel cuando el proyecto pase a producción, y este criterio se marcará entonces.
- [ ] El panel de Supabase Auth muestra el límite de registros por IP activado.
- [ ] `get_advisors` ya no reporta el WARN `rls_policy_always_true` sobre `public.scores`.
- [ ] ⏸️ **Diferido.** `get_advisors` ya no reporta el WARN `auth_leaked_password_protection`. — Consecuencia directa del punto anterior: el advisor seguirá marcando este WARN mientras la protección de contraseñas filtradas siga desactivada por el límite del plan gratuito.
- [ ] Ninguna de las 8 puntuaciones de la migración semilla de SPEC 06 se pierde ni cambia de valor al aplicar esta migración.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** exigir `auth.uid() is not null` (sesión real) para insertar en `scores`, en vez de solo endurecer los checks existentes (rangos de `score`, longitud de `name`) manteniendo el INSERT público. Resuelve el WARN de raíz en vez de mitigarlo parcialmente, y ahora que SPEC 11 ya trae auth real no hay razón para seguir aceptando puntuaciones anónimas sin identidad.
- **No:** mantener la política `WITH CHECK (true)` documentando el WARN como riesgo aceptado. Era la opción más simple pero dejaba sin resolver justo el punto que pidió el checklist.
- **Sí:** el modo invitado deja de poder guardar puntuación; en su lugar ve un aviso para iniciar sesión, pero sigue pudiendo jugar cualquiera de los 5 juegos sin cuenta. No se elimina el modo invitado, solo se le retira la persistencia de score, coherente con exigir sesión para el INSERT.
- **No:** sacar esta spec del modo invitado dejando la política pública para no tocar ese flujo. Habría dejado el WARN sin resolver, que es el objetivo central de la spec.
- **Sí:** sumar `scores.user_id` en esta misma spec, aunque SPEC 11 la había dejado fuera de su alcance. Sin esa columna, "exigir sesión" solo sirve para RLS pero no permite mejorar el match "TÚ" de `/salon`, que hoy es por texto y poco confiable entre jugadores con nombres parecidos.
- **No:** exigir sesión sin agregar `user_id` (solo `auth.uid() is not null` sin guardar nada). Habría sido una mitad de trabajo: cierra el WARN pero desperdicia la oportunidad de vincular la fila a la cuenta real, ya con auth disponible.
- **Sí:** `user_id` con default `auth.uid()` en la columna, sin cambiar la firma de `insertScore()` ni tocar cómo los 5 wrappers arman el payload. Minimiza el blast radius: la fuente de verdad de "quién soy" es la sesión de Postgres/Supabase, no algo que el cliente declare.
- **No:** pasar `userId` explícito desde cada wrapper vía `useSession()`. Habría tocado los 5 wrappers y `lib/scores-client.ts` sin necesidad, cuando el default de columna resuelve lo mismo con menos superficie de cambio.
- **Sí:** comparar el bloque "TÚ" de `/salon` por `user.id === row.userId` en vez de por nombre. Es más correcto (dos jugadores pueden coincidir en nombre) y ya no requiere adivinar coincidencias de texto.
- **No:** dejar la comparación por nombre intacta. Habría sido inconsistente con tener ya `user_id` real disponible en la misma spec.
- **Sí:** filas semilla de SPEC 06 con `user_id = NULL` (nullable), sin intentar vincularlas a cuentas reales. No existe una cuenta real detrás de esos datos sembrados; forzar un vínculo sería inventar información.
- **Sí:** solo los 3 headers listados en el checklist (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), sin CSP ni HSTS. Es el mínimo razonable sin abrir el trabajo de calibrar una CSP que no rompa OAuth, Supabase o fuentes de `next/font`.
- **No:** sumar CSP o HSTS en esta spec. Quedan para una spec futura dedicada, donde valga la pena probar a fondo que no rompen ningún flujo existente.
- **Sí:** longitud mínima de contraseña, protección de contraseñas filtradas y límite de registros por IP se aplican vía el panel de Supabase Auth (manual si el MCP no lo permite), documentado como pasos explícitos del plan — mismo patrón que SPEC 11 usó para habilitar los providers OAuth en consola.
- **No:** implementar estas tres protecciones con lógica propia en la aplicación (por ejemplo, validar longitud de contraseña en el formulario, o un rate limiter propio por IP). Supabase Auth ya las resuelve de forma nativa; reimplementarlas sería duplicar trabajo y superficie de bugs sin necesidad.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                             | Mitigación                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un jugador con partida ya en curso o terminada antes de cerrar sesión (por ejemplo, la sesión expira mientras juega) intenta guardar y el INSERT falla por RLS sin haberlo anticipado.                                                                                             | El aviso "inicia sesión para guardar" se decide por el `user` actual del contexto de sesión al momento de renderizar la pantalla de fin, que ya refleja `onAuthStateChange`; si aun así el INSERT falla, sigue existiendo el manejo de error inline ya presente (`saveError`) sin perder la partida. |
| El MCP de Supabase no expone ninguna vía para aplicar longitud mínima de contraseña, protección de contraseñas filtradas o límite de registros por IP, y el paso queda 100% manual.                                                                                                | Documentado explícitamente como paso manual en el plan (paso 7), igual que SPEC 11 ya documentó la configuración manual de OAuth en consola; se verifica con una prueba funcional (signup rechazado), no solo revisando el panel.                                                                    |
| Migrar `scores` con una columna `NOT NULL default auth.uid()` rompería las ~96 filas semilla existentes (no hay sesión al aplicar la migración, así que el default se resolvería a `NULL` en cada fila igual, pero una futura migración que la vuelva `NOT NULL` sí las rompería). | La columna se define explícitamente `nullable` en esta spec; si una spec futura necesita `NOT NULL`, deberá resolver primero qué hacer con las filas semilla sin cuenta real.                                                                                                                        |
| Endurecer la política de `INSERT` reduce el volumen de partidas "guardadas" mientras la base de jugadores con cuenta sea baja, afectando cómo de poblado se ve `/salon` a corto plazo.                                                                                             | Aceptado como consecuencia esperada y deseada del cambio: reemplaza cantidad de filas por integridad real de los datos, que es el objetivo explícito del checklist de seguridad.                                                                                                                     |

---

## Lo que **no** entra en esta spec

- Vincular las filas semilla de SPEC 06 a cuentas reales, o cualquier migración de datos históricos.
- Pantallas de perfil, historial de partidas por cuenta, o mostrar `user_id` en la UI más allá del match interno "TÚ".
- `Content-Security-Policy` o `Strict-Transport-Security`.
- Rate limiting propio a nivel de aplicación, más allá de lo que ya resuelve Supabase Auth.
- Moderación de nombres ofensivos.
- Cualquier punto de seguridad no listado en `references/security/security-checklist.md`.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
