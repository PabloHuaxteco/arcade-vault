# SPEC 06 — Leaderboard y catálogo de juegos reales en Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-09-10
> **Objetivo:** Migrar el catálogo de juegos (`lib/games.ts`) y el salón de la fama (`lib/leaderboard.ts`) de datos hardcoded/inventados a dos tablas reales de Supabase (`games` y `scores`), con `rocas` guardando puntuaciones de verdad.

---

## 1 — Por qué existe esta spec

SPEC 04 dejó el plumbing de Supabase (clientes de navegador/servidor, tipo `Database` placeholder) explícitamente sin tocar `lib/games.ts` ni `lib/leaderboard.ts`, anotando que la migración de esos dos módulos iría en una spec futura. Esta es esa spec.

Hoy `lib/games.ts` exporta un array `GAMES` hardcoded con 8 juegos (incluido su `best` inventado) y `lib/leaderboard.ts` genera puntuaciones pseudoaleatorias con `seededScores()` a partir de una semilla derivada del id del juego — nunca hay una puntuación real salvo la que guarda `rocas` en `localStorage` (SPEC 05, clave `av_scores`, función `appendScore`). Esto significa que `/biblioteca`, `/salon` y el detalle de cada juego muestran datos distintos cada vez que cambia la semilla, y ninguno refleja lo que la gente realmente juega.

Esta spec reemplaza esas dos fuentes por tablas reales: `games` (catálogo) y `scores` (puntuaciones, cualquier juego). El login sigue siendo el falso de `localStorage` (SPEC 04 no lo tocó y esta spec tampoco): el guardado de puntuaciones en `scores` es un INSERT público anónimo, sin relación con una cuenta real.

---

## 2 — Alcance

**Dentro:**

- Migración SQL en Supabase (vía `apply_migration`) que crea:
  - Tabla `public.games` (`id` texto PK, `title`, `short`, `long`, `cat`, `cover`, `color`, `best` entero — valor semilla de respaldo —, `plays` texto, `engine` opcional), con los 8 juegos actuales de `lib/games.ts` insertados como seed (mismos valores que hoy, incluido `engine: "asteroids"` en `rocas`).
  - Tabla `public.scores` (`id` identity PK, `game_id` texto con FK a `games.id`, `name` texto, `score` entero, `created_at` timestamptz por defecto `now()`), con un índice `(game_id, score desc)`.
  - RLS habilitada en ambas tablas: `SELECT` público en las dos; `INSERT` público en `scores` (sin `UPDATE`/`DELETE` públicos); ninguna política de escritura pública en `games`.
  - Checks básicos en `scores`: `name` entre 1 y 10 caracteres, `score >= 0`.
  - Seed de ~12 filas de puntuaciones por juego (8 juegos × 12 filas) generadas una sola vez a partir de la lógica de `seededScores()`/`PLAYERS` de `lib/leaderboard.ts`, convertidas a `INSERT` fijos (no pseudoaleatorios en cada build).
- Regenerar `lib/supabase/types.ts` con `generate_typescript_types`, reemplazando el placeholder de SPEC 04 por los tipos reales de `games` y `scores`.
- `lib/games.ts` reescrito: se elimina el array `GAMES`; se conservan los tipos (`Game`, `GameColor`, `GameCategory`, `CATS`) y se añaden `getGames(): Promise<Game[]>` y `getGameById(id: string): Promise<Game | null>`, que leen de Supabase (cliente de servidor) y devuelven `best` ya resuelto: `MAX(scores.score)` para ese juego si existe alguna fila, si no el valor semilla de la columna `games.best`.
- `lib/scores.ts` nuevo: `ScoreRow` (movido de `lib/leaderboard.ts`, mismo shape `{ rank, name, score, date }`), `getTopScores(gameId, limit)`, `getTopScoresByGames(gameIds, limit)` (una consulta por juego, para alimentar las pestañas de `/salon` sin refetch al cambiar de pestaña) e `insertScore({ gameId, name, score })` para usar desde el cliente de navegador.
- `lib/leaderboard.ts` eliminado (sin uso tras el cambio).
- Páginas Server Component que pasan a `await` los nuevos helpers: `app/page.tsx`, `app/biblioteca/page.tsx`, `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`.
- `app/_components/hall-of-fame.tsx`: deja de importar `GAMES`/`seededScores`; recibe `games: Game[]` y `scoresByGame: Record<string, ScoreRow[]>` como props desde `app/salon/page.tsx`. El bloque "▸ TU MEJOR MARCA" se muestra solo si, entre las filas ya cargadas del juego activo, hay una cuyo `name` coincide (sin distinguir mayúsculas) con el usuario de sesión falsa; si no hay coincidencia, el bloque no se renderiza.
- `app/_components/leaderboard.tsx`: sin cambios de markup, solo pasa a recibir `ScoreRow[]` importado de `lib/scores.ts`.
- `app/_components/games/asteroids-game.tsx`: el botón GUARDAR PUNTUACIÓN pasa de `appendScore(...)` (localStorage) a `insertScore({ gameId: game.id, name, score })` contra Supabase desde el cliente de navegador (`lib/supabase/client.ts`). Si el INSERT falla, se muestra un mensaje de error inline junto al botón y se permite reintentar; no se pierde la partida ni se navega fuera.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Autenticación real y cualquier vínculo entre `scores.name` y una cuenta verificada. El match del bloque "TÚ" es por texto, no por identidad.
- El reproductor falso (`app/_components/game-player.tsx`, usado por los 7 juegos sin `engine`) sigue guardando en `localStorage` vía `appendScore`. No se conecta a `scores` en esta spec — solo `rocas` escribe puntuaciones reales, tal como acordado.
- Contador real de `plays` (jugadas). La columna `games.plays` sigue siendo un valor estático migrado tal cual; no se incrementa con partidas reales.
- Vista alternativa de tabla en `/biblioteca` (filas en vez de tarjetas). Esta spec solo cambia la fuente de datos, no la UI de la grilla.
- Paginación, búsqueda o filtros sobre `scores` más allá del top N por juego.
- Borrado/edición de puntuaciones, moderación de nombres ofensivos, límite de tasa (rate limiting) sobre el INSERT anónimo.
- Migrar `av_user`/`av_scores` de `localStorage` o togglear el login falso.
- Realtime (que el leaderboard se actualice solo sin recargar la página).

---

## 3 — Modelo de datos

### Tablas nuevas en Supabase

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan','magenta','yellow','green')),
  best integer not null default 0,   -- valor semilla de respaldo, se muestra si "scores" no tiene filas para este juego
  plays text not null default '0',
  engine text                         -- 'asteroids' en "rocas"; null en el resto
);

create table public.scores (
  id bigint generated always as identity primary key,
  game_id text not null references public.games(id),
  name text not null check (char_length(name) between 1 and 10),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on public.scores (game_id, score desc);

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games are publicly readable" on public.games for select using (true);
create policy "scores are publicly readable" on public.scores for select using (true);
create policy "anyone can insert a score" on public.scores for insert with check (true);
```

### Tipos TypeScript (`lib/games.ts` y `lib/scores.ts`)

```ts
// lib/games.ts
export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  best: number; // ya resuelto: MAX(scores.score) o el valor semilla si no hay filas
  plays: string;
  engine?: "asteroids";
}

export const CATS: readonly string[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export async function getGames(): Promise<Game[]>;
export async function getGameById(id: string): Promise<Game | null>;
```

```ts
// lib/scores.ts
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "dd/mm/yyyy", derivado de created_at
}

export async function getTopScores(
  gameId: string,
  limit?: number
): Promise<ScoreRow[]>;
export async function getTopScoresByGames(
  gameIds: string[],
  limit?: number
): Promise<Record<string, ScoreRow[]>>;
export async function insertScore(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void>;
```

Convenciones:

- `getGames`/`getGameById` usan el cliente de servidor (`lib/supabase/server.ts`); `insertScore` usa el cliente de navegador (`lib/supabase/client.ts`) porque se llama desde `"use client"` en `asteroids-game.tsx`.
- El `best` calculado en vivo evita una segunda consulta por tarjeta: `getGames()` trae todos los juegos y todas las puntuaciones máximas en como máximo dos consultas (una a `games`, una agregada a `scores` agrupada por `game_id`), y hace el `Math.max(seed, real)` en memoria.
- `av_user`/`av_scores` de `lib/storage.ts` no cambian de formato; siguen existiendo para el login falso y para el reproductor falso de los 7 juegos sin motor real.

---

## 4 — Plan de implementación

1. **Migración de esquema.** `apply_migration` con el SQL de la sección 3 (tablas, índice, RLS, políticas) más los `insert` de los 8 juegos (valores actuales de `lib/games.ts`) y ~12 filas de `scores` por juego generadas a partir de `seededScores()`/`PLAYERS`. Verificación: `list_tables` muestra `games` y `scores`; `execute_sql` con `select count(*) from scores` da 96.
2. **Tipos generados.** `generate_typescript_types` y reemplazar el contenido de `lib/supabase/types.ts`. Verificación: `npx tsc --noEmit` compila.
3. **`lib/scores.ts`.** Crear el módulo con `ScoreRow`, `getTopScores`, `getTopScoresByGames`, `insertScore` contra las tablas reales. Verificación: `npx tsc --noEmit` compila; una llamada manual a `getTopScores("rocas", 5)` desde una ruta temporal o consola devuelve filas.
4. **Reescribir `lib/games.ts`.** Quitar `GAMES`, mantener tipos y `CATS`, añadir `getGames`/`getGameById` con el cálculo de `best`. Verificación: `npx tsc --noEmit` compila.
5. **Borrar `lib/leaderboard.ts`.** Verificación: `npm run build` falla si queda algún import roto, así que se hace después de actualizar los consumidores (paso 6).
6. **Actualizar páginas y componentes consumidores** en este orden, comprobando cada uno en el navegador antes de seguir:
   - `app/page.tsx` (home): `await getGames()`, mantiene el `slice(0, 6)`.
   - `app/biblioteca/page.tsx`: `await getGames()`.
   - `app/juego/[id]/page.tsx`: `await getGameById(id)` + `await getTopScores(id, 10)` para `<Leaderboard>`.
   - `app/juego/[id]/jugar/page.tsx`: `await getGameById(id)`.
   - `app/salon/page.tsx`: `await getGames()` + `await getTopScoresByGames(ids, 12)`, pasados como props a `<HallOfFame>`.
   - `app/_components/hall-of-fame.tsx`: recibe `games`/`scoresByGame` por props, quita el import de `GAMES`/`seededScores`, ajusta el bloque "TÚ" a la coincidencia por nombre real.
   - `app/_components/leaderboard.tsx`: cambia el import de `ScoreRow` a `lib/scores.ts`.
     Verificación de este paso: `/`, `/biblioteca`, `/juego/rocas`, `/salon` renderizan sin errores en consola con datos que vienen de Supabase (verificable comparando contra `execute_sql`).
7. **Guardado real en `rocas`.** En `app/_components/games/asteroids-game.tsx`, cambiar el botón GUARDAR PUNTUACIÓN de `appendScore` a `insertScore`, con manejo de error inline. Verificación manual: jugar una partida en `/juego/rocas/jugar`, guardar, y ver la fila nueva en `/salon` (pestaña ROCAS) tras recargar.
8. **Cierre.** `npm run lint` y `npm run build` en verde. Repasar que `lib/leaderboard.ts` ya no existe y que no queda ningún import roto.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] Existen las tablas `public.games` y `public.scores` en Supabase, con RLS habilitada en ambas.
- [ ] `games` tiene exactamente 8 filas con los mismos `id`/`title`/`cat`/`cover`/`color`/`plays`/`engine` que el `GAMES` original; `rocas` tiene `engine = 'asteroids'`.
- [ ] `scores` tiene datos semilla para los 8 juegos (no está vacía en ninguno al día de hoy).
- [ ] Un `INSERT` anónimo en `scores` con datos válidos funciona sin autenticación; un `UPDATE` o `DELETE` anónimo falla por RLS.
- [ ] `lib/games.ts` ya no exporta `GAMES`; exporta `getGames` y `getGameById`.
- [ ] `lib/leaderboard.ts` no existe en el repo.
- [ ] `/biblioteca` muestra los 8 juegos con el `best` calculado desde `scores` (no el valor hardcoded original) cuando existan puntuaciones reales mayores.
- [ ] `/juego/rocas` muestra en su leaderboard lateral las puntuaciones reales de la tabla `scores`, no las de `seededScores()`.
- [ ] Jugar una partida completa en `/juego/rocas/jugar`, guardar con GUARDAR PUNTUACIÓN, y ver esa puntuación nueva reflejada en `/salon` (pestaña ROCAS) tras recargar la página.
- [ ] Si el `INSERT` de la puntuación falla (por ejemplo, sin conexión), se muestra un error en el modal sin perder la partida ni redirigir.
- [ ] `/salon` muestra el bloque "▸ TU MEJOR MARCA" únicamente cuando el nombre de la sesión (falsa) coincide con alguna fila real cargada para el juego activo; en caso contrario no aparece nada inventado.
- [ ] `app/_components/game-player.tsx` (reproductor falso de los 7 juegos sin motor real) sigue usando `appendScore`/`localStorage` sin cambios.
- [ ] `app/_components/auth-form.tsx`, `app/_components/session-provider.tsx`, `app/entrar/page.tsx` y el formato de `lib/storage.ts` no se han modificado.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** dos tablas separadas, `games` y `scores`, con FK de `scores.game_id` a `games.id`. Refleja el modelo actual (`Game.id` como string estable) sin introducir UUIDs innecesarios.
- **No:** una sola tabla con el catálogo y las puntuaciones mezcladas. Complica las políticas de RLS (el catálogo no debe aceptar INSERT público, las puntuaciones sí).
- **Sí:** `INSERT` público anónimo en `scores` vía la clave publishable, sin `UPDATE`/`DELETE` públicos. Coherente con que hoy cualquiera "guarda" su puntuación sin cuenta real; limitar mutación a solo alta reduce el riesgo de manipular el ranking existente.
- **No:** exigir autenticación real para guardar puntuaciones. Bloquearía el guardado hasta que exista una spec de auth, y el alcance actual asume login falso.
- **Sí:** `best` calculado en vivo (`MAX(scores.score)` con fallback a la columna semilla `games.best`). Es el punto real de tener un leaderboard: que el catálogo refleje lo que la gente juega.
- **No:** mantener `best` como columna estática sin relación con `scores`. Dejaría `/biblioteca` mostrando datos falsos para siempre, que es justamente lo que esta spec corrige.
- **Sí:** sembrar `scores` con las ~12 filas por juego generadas a partir de la lógica existente de `seededScores()`/`PLAYERS`, convertidas a `INSERT` fijos en la migración. Evita que `/salon` se vea vacío el día 1 y reaprovecha el trabajo de diseño de nombres/fechas ya hecho.
- **No:** dejar `lib/leaderboard.ts` vivo "por si acaso". Tras mover su lógica a la migración SQL, el módulo queda sin ningún import — código muerto.
- **Sí:** el leaderboard de `/salon` es real para los 8 juegos, aunque solo `rocas` reciba puntuaciones nuevas de verdad; el resto queda con la semilla hasta que tengan motor real. No se inventa nada nuevo, solo se conserva lo sembrado.
- **No:** conectar el reproductor falso (`game-player.tsx`) a `scores` en esta spec. Guardaría puntuaciones de un juego que ni siquiera es real todavía; se decide junto con el motor real de cada juego (como en SPEC 05).
- **Sí:** el bloque "TÚ" en `/salon` se resuelve por coincidencia de texto entre el nombre de sesión falsa y `scores.name`, limitado a las filas ya cargadas (top 12). Es la única relación posible sin auth real, y se documenta la limitación en vez de fingir que es infalible.
- **No:** una consulta única con `GROUP BY`/ventana para el top N de todos los juegos a la vez. Con 8 juegos, 8 consultas simples (`Promise.all`) son más legibles y evitan SQL con funciones de ventana en esta capa.
- **Sí:** migración aplicada vía `apply_migration` del MCP de Supabase, versionada como el resto del esquema. Es el camino estándar y reproducible.
- **No:** vista de tabla alternativa en `/biblioteca` o contador real de `plays`. Son cambios de UI/alcance independientes de "mover los datos a Supabase"; quedan para specs futuras si se piden.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                        | Mitigación                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El `INSERT` público anónimo en `scores` permite spam o puntuaciones absurdas (`score` gigante).                                               | Los checks (`score >= 0`, `name` entre 1 y 10 caracteres) cubren lo básico; no hay límite superior de `score` ni rate limiting en esta spec — se documenta como riesgo aceptado, no como bug.                           |
| `getGames()` hace una consulta agregada a `scores` en cada carga de `/biblioteca` y `/`; con muchas filas podría ser lenta.                   | El índice `(game_id, score desc)` cubre la agregación; con el volumen actual (decenas de filas por juego) el costo es trivial. Revisar si el leaderboard crece mucho.                                                   |
| El bloque "TÚ" no encuentra coincidencia si el nombre del usuario está fuera del top 12 cargado.                                              | Comportamiento documentado y aceptado en el alcance: sin esa fila, simplemente no se muestra el bloque, no se inventa un rango.                                                                                         |
| `lib/supabase/types.ts` regenerado puede no coincidir exactamente con los tipos manuales de `Game`/`ScoreRow` si cambian nombres de columnas. | El paso 2 del plan regenera los tipos antes de escribir `lib/games.ts`/`lib/scores.ts`, así que estos se escriben contra el esquema real, no al revés.                                                                  |
| Borrar `lib/leaderboard.ts` antes de actualizar todos sus consumidores rompe el build.                                                        | El plan lo deja como paso 5, después de crear `lib/scores.ts` (paso 3) pero antes de migrar los consumidores (paso 6) — se ejecuta en el orden del plan, verificando con `npm run build` al final del paso 6, no antes. |

---

## Lo que **no** entra en esta spec

- Autenticación real ni vínculo verificado entre `scores.name` y una cuenta.
- Conectar el reproductor falso de los 7 juegos sin motor real a `scores`.
- Contador real de `plays`.
- Vista de tabla alternativa en `/biblioteca`.
- Paginación/búsqueda sobre `scores`, borrado/edición de puntuaciones, moderación de nombres, rate limiting.
- Cambios al login falso (`av_user`) o al reproductor falso más allá de lo descrito.
- Realtime en el leaderboard.

Cada uno de esos puntos, si llega, va en su propia spec.
