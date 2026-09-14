# GAME JAM — ÚLTIMO REBOTE (MVP)

> **Estado:** Borrador
> **Tema:** DUELO PIXEL — 1v1 local de paletas estilo Pong
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-14
> **Objetivo:** Diseñar desde cero un motor de duelo de paletas contra una escalera infinita de rivales IA, con marcador acumulado, 3 vidas y velocidad creciente, enchufado a una ficha nueva `ultimo-rebote` con leaderboard real en Supabase.

---

## 1 — Por qué existe esta spec

El tema recibido es **DUELO PIXEL**: 1v1 local de paletas, un Pong. La descripción del tema trae incorporada su propia objeción, tomada literalmente de la fila `duelo-pixel` de `references/game-suggestions-todo.md` (veredicto `En espera`, 2026-09-12): _"1v1 local de paletas (Pong) no tiene score natural creciente para leaderboard global; necesitaría redefinirse como modo contra IA con marcador acumulado."_

Esta spec es exactamente esa redefinición. El Pong local a dos jugadores no produce un número que ordene una tabla global: un 5-3 entre dos personas sentadas en el mismo teclado no dice nada comparado con otro 5-3. La lectura jugable que sí puntúa es convertir el duelo en una **escalera de rivales IA**: el jugador maneja una sola paleta, se enfrenta a un rival tras otro, cada uno más rápido y más certero, y el marcador **no se reinicia entre rivales** — se acumula. El score crece con cada devolución, con cada punto ganado y con cada rival derrotado, y la partida termina cuando el jugador agota sus 3 vidas. Loop corto, condición de fin clara, número creciente: encaja en el leaderboard de SPEC 06 sin inventar nada.

El tema también obliga a resolver una colisión con el catálogo: la ficha `duelo-pixel` (VERSUS, `cover-duelo`, cyan, "Dos paletas. Una pelota. Reflejos máximos.") ya está sembrada desde SPEC 06 y sigue sin motor, listada como pendiente en `references/implemented-games.md`. El flujo `game-jam` no consume ni reescribe fichas ajenas: crea una ficha nueva con id propio (`ultimo-rebote`) mediante `insert`, y deja `duelo-pixel` intacta y sin motor. La convivencia de ambas fichas se decide en la sección 6.

No existe carpeta de referencia en `references/started-games/` para este juego: el motor se diseña desde cero, igual que SPEC 09 (Snake) y que `01-salta-charcos-mvp.md`. Todo se dibuja con formas vectoriales sobre canvas, sin assets externos. Como en SPEC 05/07/08/09, no se usa `/frontend-design`: se reutiliza una `.cover-*` ya existente y las clases `.crt`, `.player-hud`, `.btn`, `.modal`, `.game-canvas`.

---

## 2 — Alcance

**Dentro:**

- Migración Supabase (`apply_migration`) con un **`insert`**, no un `update` — a diferencia de SPEC 07/08/09, que activaban el motor de una ficha ya sembrada, aquí el juego es nuevo y la ficha no existe:

  ```sql
  insert into public.games (id, title, short, long, cat, cover, color, best, plays, engine)
  values (
    'ultimo-rebote',
    'ÚLTIMO REBOTE',
    'Una paleta contra una escalera infinita de rivales.',
    'Tu paleta a la izquierda, un rival tras otro a la derecha. Cada devolución suma, cada punto suma más y derribar a un rival dispara el marcador. Nadie te devuelve las vidas: el duelo dura hasta que la pelota pasa por tu lado tres veces.',
    'VERSUS',
    'cover-duelo',
    'magenta',
    0,
    '0',
    'pong'
  );
  ```

  `best = 0` y `plays = '0'`. **Sin filas nuevas en `scores`**: el leaderboard de este juego arranca vacío hasta que alguien juegue de verdad. No hace falta `generate_typescript_types`: `games.engine` ya es `string | null` en `lib/supabase/types.ts`, así que el valor `'pong'` tipa sin tocar el archivo generado.

- `lib/games.ts`: el union `engine?: "asteroids" | "tetris" | "arkanoid" | "snake" | "frogger"` pasa a incluir `| "pong"`, **en los tres sitios** — la interfaz `Game` y los dos casts literales `(g.engine as ... | null) ?? undefined` que aparecen dentro de `getGames()` y de `getGameById()`. Los tres cambian juntos o el tipo miente sin que TypeScript falle.
- `lib/games/pong/engine.ts`: motor nuevo, DOM puro, sin importar nada de `react` ni de `next/*`.
  - Constantes puras a nivel de módulo: `GAME_W = 800`, `GAME_H = 600`, `PADDLE_W = 14`, `PADDLE_H = 90`, `PADDLE_MARGIN = 32`, `PLAYER_SPEED = 520`, `BALL_R = 8`, `BALL_BASE_SPEED = 320`, `BALL_SPEED_STEP = 18`, `MAX_BALL_SPEED = 760`, `MAX_BOUNCE_RAD = 1.05` (≈60°), `POINTS_TO_WIN = 5`, `LIVES = 3`, `SERVE_DELAY_MS = 700`, `POINTS_RETURN = 10`, `POINTS_POINT = 100`, `POINTS_RIVAL = 500`, `RIVAL_BASE_SPEED = 300`, `RIVAL_SPEED_STEP = 28`, `MAX_RIVAL_SPEED = 620`, `RIVAL_BASE_ERROR = 46`, `RIVAL_ERROR_STEP = 5`, `MIN_RIVAL_ERROR = 6`, `RIVAL_BALL_SPEED_STEP = 24`.
  - Todo el estado de partida vive dentro de `createPongGame(canvas, opts)`: posición vertical de la paleta del jugador y de la del rival, teclas pulsadas, posición y velocidad de la pelota, `score`, `lives`, `rival` (índice del rival actual, empieza en 1), puntos ganados al rival actual (`won`, de 0 a `POINTS_TO_WIN - 1`), objetivo actual de la IA con su error, temporizador de saque, lado que destella tras un punto, y fase `serving | playing | over`.
  - `opts`: `{ onState: (s: PongSnapshot) => void }`.
  - Devuelve un `PongHandle` con `start()`, `pause()`, `resume()`, `restart()`, `end()`, `destroy()`, misma forma que los cinco motores anteriores.
  - **Bucle `requestAnimationFrame` con `dt` en segundos y clamp a `0.05`**, igual que los cinco motores anteriores. Todas las velocidades están en píxeles por segundo — nunca "por frame".
  - **Paleta del jugador (izquierda).** Flechas ↑/↓ mueven la paleta a `PLAYER_SPEED` px/s mientras la tecla está pulsada (movimiento continuo por estado de tecla, no por evento repetido). La paleta se clampa a los bordes superior e inferior del canvas.
  - **Paleta rival (derecha), IA.** Cuando la pelota va hacia el rival (`vx > 0`), la paleta persigue `objetivoY = ballY + errorActual`, moviéndose como máximo a `rivalSpeed` px/s. `errorActual` se sortea una sola vez por rally, en el instante en que el jugador devuelve la pelota, dentro de `±rivalError` — no se recalcula por frame, para que el rival se sienta constante y no tembloroso. Cuando la pelota se aleja (`vx < 0`), la paleta deriva hacia el centro vertical del canvas al 60 % de su velocidad. `rivalSpeed = min(RIVAL_BASE_SPEED + (rival - 1) × RIVAL_SPEED_STEP, MAX_RIVAL_SPEED)` y `rivalError = max(RIVAL_BASE_ERROR - (rival - 1) × RIVAL_ERROR_STEP, MIN_RIVAL_ERROR)`.
  - **Pelota.** Rebota en los bordes superior e inferior invirtiendo `vy`. Al golpear una paleta, el ángulo de salida se calcula con el desplazamiento del impacto respecto al centro de la paleta: `angulo = (offset / (PADDLE_H / 2)) × MAX_BOUNCE_RAD`, y la rapidez sube `BALL_SPEED_STEP` con techo `MAX_BALL_SPEED`. Tras el impacto la pelota se reposiciona justo fuera de la paleta para que no quede "pegada" rebotando dentro de ella.
  - **Puntuación.** Cada devolución del jugador suma `POINTS_RETURN`. Cada pelota que pasa por detrás del rival suma `POINTS_POINT` y `won += 1`. Al llegar `won` a `POINTS_TO_WIN`, el rival cae: `score += POINTS_RIVAL`, `rival += 1`, `won` vuelve a 0, y sube tanto la velocidad base de la pelota (`BALL_BASE_SPEED + (rival - 1) × RIVAL_BALL_SPEED_STEP`) como la velocidad y precisión de la IA. **El marcador nunca se reinicia entre rivales** — es el punto central de la redefinición del tema.
  - **Vidas y fin.** Cada pelota que pasa por detrás de la paleta del jugador cuesta una vida y **no** otorga nada al rival más allá de eso. Con `lives = 0`, la fase pasa a `over` y se emite el snapshot final con `over: true`. Las vidas no se recuperan en el MVP.
  - **Saque.** Tras cada punto (de cualquier lado) la fase pasa a `serving` durante `SERVE_DELAY_MS`: la pelota se coloca en el centro, la pared del lado que encajó el punto destella, y al terminar el temporizador la pelota sale hacia quien acaba de encajar el punto, con rapidez igual a la base del rival actual y un ángulo vertical aleatorio dentro de `±MAX_BOUNCE_RAD / 2`. El jugador puede mover su paleta durante `serving`.
  - `start()` ata los listeners `keydown`/`keyup` (solo ↑ y ↓) y arranca el `requestAnimationFrame`; se dispara al montar el wrapper, sin pantalla de inicio propia. `preventDefault` solo actúa en fase `playing` o `serving`, nunca en `over` ni en pausa.
  - `pause()` cancela el rAF; `resume()` pone `lastTime = null` para que el `dt` acumulado durante la pausa no haga saltar la pelota ni consumir el temporizador de saque.
  - `restart()` reinicia en caliente (paletas centradas, `score` 0, `lives` 3, `rival` 1, `won` 0, saque nuevo) sin recrear el handle. `end()` fuerza la fase `over` con el estado actual.
  - **Dibujo vectorial:** fondo oscuro, línea central discontinua, paleta del jugador en cyan y paleta rival en magenta (ambas con `shadowBlur` de neón), pelota como cuadrado/círculo amarillo con estela corta, y destello de la pared del lado que encajó el punto durante `serving`. El marcador del duelo contra el rival actual se dibuja como **pips** (`POINTS_TO_WIN` marcas pequeñas en la mitad superior, las ganadas rellenas), no como texto. Sin HUD de texto en el canvas ni overlay de "GAME OVER": lo único dibujado que no es escena pura son esos pips y el destello, información efímera ligada a la partida (mismo criterio que los temporizadores de power-up de asteroides, el parpadeo de muerte de Snake o la barra de reloj de `salta-charcos`).
  - `onState(snapshot)` se emite solo cuando cambia `score`, `lives`, `rival` o `over` — nunca por frame y nunca por el movimiento de las paletas.
- `lib/games/types.ts`: **sin cambios**. `HudStat` y `GameSnapshot` ya existen desde SPEC 07 y cubren este juego; `PongSnapshot` los extiende desde el propio motor.
- `app/_components/games/pong-game.tsx` (`"use client"`): wrapper de React, calcado de `snake-game.tsx` / `frogger-game.tsx`.
  - `<canvas className="game-canvas">` de 800×600 dentro de `.crt` / `.crt-screen` / `.crt-bottom`.
  - `.player-hud` con `.hud-stat`: Jugador, Puntuación, Vidas, Rival (`#3`).
  - Nombre de jugador con `useState("INVITADO")` + `useEffect` sobre `useSession().user` (se hidrata desde `localStorage` después del montaje, nunca se lee una sola vez).
  - Botones `.btn` PAUSA/REANUDAR (`yellow`), FIN (`magenta`), SALIR (`ghost`, `router.push("/juego/ultimo-rebote")`), más el listener propio de `KeyP` y `Escape` para alternar pausa por el mismo camino que el botón.
  - Modal `.modal-bd > .modal` "FIN DEL JUEGO" con su ciclo `saving / saved / saveError`: `insertScore({ gameId: game.id, name, score })` importado de `lib/scores-client.ts` (**nunca** de `lib/scores.ts`, que arrastra `next/headers` y rompe el bundle de cliente), toast `.toast-saved` para el éxito y el mismo elemento en magenta (`style={{ color: "var(--magenta, #ff2fb3)" }}`) para el error inline, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`.
- `app/juego/[id]/jugar/page.tsx`: se añade `pong: PongGame` al registro `ENGINES` ya existente (`{ asteroids, tetris, arkanoid, snake, frogger }`). La página sigue siendo Server Component con `await params` y `PageProps<"/juego/[id]/jugar">`.
- **Sin cambios en `app/globals.css`**: se reutiliza `cover-duelo` (ya existe, y dibuja literalmente dos paletas, la línea central y una pelota) y el canvas de 800×600 encaja exacto en el `aspect-ratio: 4 / 3` que `.game-canvas` ya fija.
- `npm run lint` y `npm run build` en verde.

**Fuera de alcance (planificado en `02-ultimo-rebote-extension.md`):**

- Modo 1v1 local real a dos jugadores en el mismo teclado (el tema literal), como modo de exhibición sin guardado de puntuación.
- Personalidades de rival (muro, agresivo, cortador) en vez de una única IA parametrizada por velocidad y error.
- Efecto/spin: la velocidad vertical de la paleta en el momento del golpe altera la trayectoria de la pelota.
- Power-ups y modificadores de duelo (paleta que encoge, pelota doble, muro central, inversión de controles).
- Racha de devoluciones consecutivas con multiplicador de puntuación.
- Vida extra al derrotar a un rival o al superar un umbral de puntuación.
- Rival jefe cada 5 rivales, con paleta doble o comportamiento propio.
- Dificultad progresiva avanzada: paleta del jugador que encoge por tramo de rivales y tabla de velocidades por rival en vez de un incremento lineal.

**Fuera de alcance (exclusiones vigentes de SPEC 05/06, no se tocan aquí):**

- Sin auth real: el nombre del jugador sigue saliendo del `localStorage` de `session-provider`.
- Sin contador de `plays` real: la columna se inserta como texto estático `'0'`.
- Sin rate limiting ni validación de servidor en el `insert` de puntuaciones.
- Sin realtime en el leaderboard: `/salon` sigue actualizándose al recargar.
- Sin sonido, sin `devicePixelRatio` ni resolución dinámica.
- Sin controles táctiles: el patrón de `specs/10-controles-tactiles-moviles.md` se aplica, si se decide, con el agente `mobile-porter` después de implementar este MVP, no dentro de esta spec.
- Sin WASD ni ningún segundo esquema de teclado: solo ↑/↓, mismo criterio que los cinco motores anteriores.
- Sin pausa automática al perder el foco de la pestaña.
- Sin tests automatizados (no hay runner configurado), sin i18n, sin `/frontend-design` ni `.cover-*` nueva.
- Sin skins ni temas visuales: eso es trabajo de `skin-designer` sobre el juego ya implementado, no de esta spec.

---

## 3 — Modelo de datos

### Campo `engine` ampliado en `lib/games.ts`

```ts
export interface Game {
  // ...campos existentes...
  engine?: "asteroids" | "tetris" | "arkanoid" | "snake" | "frogger" | "pong";
}
```

Los dos casts literales de `getGames()` y `getGameById()` se amplían con `| "pong"` exactamente igual.

### Ficha nueva en Supabase (`insert`, no `update`)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, engine)
values (
  'ultimo-rebote',
  'ÚLTIMO REBOTE',
  'Una paleta contra una escalera infinita de rivales.',
  'Tu paleta a la izquierda, un rival tras otro a la derecha. Cada devolución suma, cada punto suma más y derribar a un rival dispara el marcador. Nadie te devuelve las vidas: el duelo dura hasta que la pelota pasa por tu lado tres veces.',
  'VERSUS',
  'cover-duelo',
  'magenta',
  0,
  '0',
  'pong'
);
```

Ninguna fila de `scores` se inserta. `duelo-pixel` no se toca: sigue sin `engine` y con el reproductor falso.

### Snapshot y handle del motor (`lib/games/pong/engine.ts`)

```ts
import type { GameSnapshot } from "@/lib/games/types";

export interface PongSnapshot extends GameSnapshot {
  lives: number; // vidas restantes del jugador, empieza en 3
  rival: number; // rival actual, empieza en 1 y no tiene techo
}

export interface PongHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createPongGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: PongSnapshot) => void }
): PongHandle;
```

`stats` se construye dentro del motor en cada `onState`, con tres entradas como máximo además de "Jugador" (que lo añade el wrapper):

```ts
stats: [
  { l: "Puntuación", v: String(score) },
  { l: "Vidas", v: String(lives) },
  { l: "Rival", v: `#${rival}` },
];
```

### Tabla de puntuación

| Evento                                         | Puntos            |
| ---------------------------------------------- | ----------------- |
| Devolución de la pelota con la paleta           | `POINTS_RETURN` = 10   |
| Pelota que pasa por detrás del rival            | `POINTS_POINT` = 100   |
| Rival derrotado (`POINTS_TO_WIN` = 5 puntos)    | `POINTS_RIVAL` = 500   |
| Pelota que pasa por detrás del jugador          | 0 puntos, −1 vida      |

Convenciones:

- Mundo fijo de 800×600 px, origen arriba-izquierda, como los cinco motores anteriores.
- Todas las velocidades en píxeles por segundo; `dt` en segundos con clamp a `0.05`.
- Ángulos en radianes; `MAX_BOUNCE_RAD = 1.05` es el desvío máximo respecto a la horizontal al golpear el extremo de una paleta.
- El motor no importa nada de `next/*` ni de React: recibe un `HTMLCanvasElement`.
- El wrapper es la única isla `"use client"` nueva de este juego; la página `jugar` sigue siendo Server Component.
- Sin assets externos: todo se dibuja con formas vectoriales.

---

## 4 — Plan de implementación

1. **Ficha y campo de datos.** Migración `apply_migration` con el `insert` de la sección 3 (sin filas en `scores`). En `lib/games.ts`, ampliar el union `engine` con `| "pong"` en los **tres** sitios (interfaz `Game`, cast de `getGames()`, cast de `getGameById()`). Verificación: `npx tsc --noEmit` compila; `select id, cat, cover, color, engine from games where id = 'ultimo-rebote'` devuelve la fila; `select count(*) from scores where game_id = 'ultimo-rebote'` devuelve 0; la ficha aparece en `/biblioteca` bajo VERSUS y `/juego/ultimo-rebote/jugar` muestra aún el reproductor falso `<GamePlayer>` (todavía no hay entrada en `ENGINES`).
2. **Motor — escena y bucle base.** Crear `lib/games/pong/engine.ts` con todas las constantes de la sección 2 y `createPongGame(canvas, opts)` con el estado de partida encapsulado. Implementar `start()`/`destroy()` (arranca y cancela el `requestAnimationFrame`, sin listeners todavía) y `draw()` (fondo, línea central discontinua, ambas paletas, pelota, pips del duelo). Verificación: `npx tsc --noEmit` compila; montado en una página de prueba se ven las dos paletas centradas, la línea central y la pelota quieta, sin movimiento.
3. **Motor — pelota, rebotes y saque.** Añadir el movimiento de la pelota en px/s, el rebote en los bordes superior e inferior, la colisión con ambas paletas (ángulo por desplazamiento del impacto, aumento de rapidez con techo, reposicionamiento fuera de la paleta) y el ciclo de saque (`serving` con `SERVE_DELAY_MS`, destello del lado que encajó el punto, salida hacia quien encajó). Verificación: `npx tsc --noEmit`; en la página de prueba la pelota rebota indefinidamente contra las paredes y contra paletas fijas, y tras pasar un lado se reinicia el saque desde el centro.
4. **Motor — input del jugador e IA del rival.** Listeners `keydown`/`keyup` de ↑/↓ atados en `start()` y retirados en `destroy()`, con movimiento continuo por estado de tecla, clamp a los bordes y `preventDefault` solo en fase `playing`/`serving`. IA del rival: persecución con `rivalSpeed`, `errorActual` sorteado una vez por rally, deriva al centro cuando la pelota se aleja. Verificación: `npx tsc --noEmit`; se puede pelotear contra el rival, que falla de vez en cuando y no es un muro perfecto.
5. **Motor — puntuación, escalera de rivales, vidas y snapshot.** Sumar `POINTS_RETURN` por devolución, `POINTS_POINT` y `won += 1` por punto al rival, `POINTS_RIVAL` y `rival += 1` al llegar a `POINTS_TO_WIN` (subiendo velocidad base de pelota, velocidad de IA y precisión de IA), y `lives -= 1` por punto encajado hasta la fase `over`. Implementar `pause()`/`resume()` (sin salto de `dt` ni del temporizador de saque), `restart()` (reinicio en caliente) y `end()` (fuerza `over`). `onState` emite `PongSnapshot` solo al cambiar `score`/`lives`/`rival`/`over`. Verificación: `npx tsc --noEmit`; una partida completa de prueba muestra el score acumulándose sin reinicio al cambiar de rival y termina tras la tercera pelota encajada.
6. **Regla CSS del canvas.** Ninguna: se reutiliza `.game-canvas` de `app/globals.css` (800×600 encaja exacto en 4/3) y `cover-duelo` ya existe. Verificación: `git diff --stat app/globals.css` sale vacío y `npm run build` sigue en verde.
7. **Wrapper — canvas y HUD.** Crear `app/_components/games/pong-game.tsx` (`"use client"`) con la estructura `.crt` / `.crt-screen` / `.crt-bottom` y el `<canvas className="game-canvas">`. `useEffect` que crea el handle, llama `start()` y hace `destroy()` en el cleanup. `.player-hud` con Jugador (`useState("INVITADO")` + `useEffect` sobre `useSession().user`), Puntuación, Vidas y Rival desde el snapshot. Botones PAUSA/REANUDAR, FIN y SALIR (`router.push("/juego/ultimo-rebote")`) más el listener de `KeyP`/`Escape`. Verificación: `npx tsc --noEmit`; el componente monta y el HUD refleja el snapshot en tiempo real.
8. **Wrapper — modal de fin y guardado.** Modal "FIN DEL JUEGO" con `insertScore({ gameId: game.id, name, score })` de `lib/scores-client.ts`, toast de guardado, error inline en magenta reutilizando `.toast-saved`, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`. Verificación: perder las 3 vidas o pulsar FIN abre el modal; GUARDAR crea una fila nueva en `scores` (comprobable con `execute_sql`).
9. **Registro `engine → componente`.** Añadir `pong: PongGame` al objeto `ENGINES` de `app/juego/[id]/jugar/page.tsx`. Verificación: `/juego/ultimo-rebote/jugar` muestra el canvas jugable; `/juego/rocas/jugar`, `/juego/caida/jugar`, `/juego/bloque-buster/jugar`, `/juego/serpentina/jugar` y el juego con motor `frogger` siguen funcionando sin cambios.
10. **Cierre.** `npm run lint` y `npm run build` en verde. Repaso manual en `/juego/ultimo-rebote/jugar`: ganar al rival #1 viendo que el score no se reinicia, comprobar que el rival #2 es visiblemente más rápido, perder las tres vidas, guardar la puntuación y verla en `/salon` (pestaña ÚLTIMO REBOTE) tras recargar.

---

## 5 — Criterios de aceptación

**Del juego:**

- [ ] La ficha `ultimo-rebote` existe en `public.games` con `cat = 'VERSUS'`, `cover = 'cover-duelo'`, `color = 'magenta'`, `best = 0`, `plays = '0'` y `engine = 'pong'`.
- [ ] `scores` no tiene ninguna fila con `game_id = 'ultimo-rebote'` hasta que alguien guarde una puntuación desde el modal.
- [ ] La ficha `duelo-pixel` sigue sin `engine` y sin cambios en ninguna de sus columnas.
- [ ] `/juego/ultimo-rebote/jugar` renderiza un `<canvas>` jugable de 800×600 dentro del marco `.crt`.
- [ ] Las flechas ↑ y ↓ mueven la paleta del jugador de forma continua mientras la tecla está pulsada, y la paleta no sale del canvas por arriba ni por abajo.
- [ ] Devolver la pelota suma exactamente 10 puntos en el HUD; que la pelota pase por detrás del rival suma exactamente 100.
- [ ] Ganar 5 puntos al rival actual suma 500 puntos, incrementa el stat "Rival" en 1 y **no** reinicia la puntuación acumulada.
- [ ] El rival #2 se mueve visiblemente más rápido y falla menos que el rival #1; la pelota sale del saque con más velocidad base.
- [ ] Cada pelota que pasa por detrás de la paleta del jugador resta exactamente una vida; con 0 vidas aparece el modal "FIN DEL JUEGO".
- [ ] El ángulo de salida de la pelota depende de dónde golpea la paleta: el centro devuelve casi horizontal, los extremos devuelven con desvío marcado.
- [ ] La pelota nunca queda atrapada dentro de una paleta rebotando en su interior.
- [ ] Tras cada punto, la pelota se detiene en el centro durante el retardo de saque, el lado que encajó destella, y luego sale hacia quien encajó el punto.
- [ ] Los pips del duelo dibujados en el canvas reflejan los puntos ganados al rival actual y se vacían al cambiar de rival.
- [ ] La barra `.player-hud` muestra Jugador, Puntuación, Vidas y Rival, alimentados por el snapshot del motor (no con un `setInterval`).
- [ ] El botón PAUSA (o `P` / `Escape`) congela el juego; REANUDAR lo continúa sin que la pelota salte de golpe ni se consuma el temporizador de saque.
- [ ] El botón SALIR navega a `/juego/ultimo-rebote`; JUGAR DE NUEVO reinicia la partida (score 0, 3 vidas, rival #1) sin recargar la ruta; VOLVER AL VAULT navega a `/biblioteca`.

**Invariantes de plataforma (sección (g) del contrato):**

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `lib/games/pong/engine.ts` no importa nada de `react` ni de `next/*`.
- [ ] La ficha existe en `public.games` con su `engine` correspondiente; ninguna otra ficha lleva `engine = 'pong'` por error.
- [ ] `/juego/ultimo-rebote/jugar` renderiza el `<canvas>` jugable dentro del marco `.crt` y responde a los controles definidos en esta spec.
- [ ] Guardar una puntuación desde el modal la hace aparecer en `/salon` (pestaña ÚLTIMO REBOTE) tras recargar la página.
- [ ] Si el `INSERT` de la puntuación falla, se muestra un error inline en el modal sin perder la partida ni navegar fuera.
- [ ] `insertScore` se importa de `lib/scores-client.ts` y en ningún punto del árbol de cliente se importa `lib/scores.ts`.
- [ ] Al navegar fuera de `/juego/ultimo-rebote/jugar` no quedan bucles de `requestAnimationFrame` ni listeners de teclado vivos (verificable en el rendimiento y en la consola); volver a entrar no duplica el bucle.
- [ ] Mientras el juego está en pausa o en fin de partida, pulsar las flechas no bloquea el scroll de la página.
- [ ] Los juegos que no tienen `engine` (`duelo-pixel`, `gloton`, `invasores`, `ranaria`) siguen mostrando `<GamePlayer>` sin cambios.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** interpretar "DUELO PIXEL" como duelo **contra IA con marcador acumulado**, no como 1v1 local. Es la redefinición que pide literalmente la fila `duelo-pixel` de `references/game-suggestions-todo.md` (`En espera`, 2026-09-12) y la única lectura del tema que produce un número creciente comparable en el leaderboard global de SPEC 06.
- **No:** 1v1 local a dos jugadores como modo del MVP. Sin score global no hay leaderboard, y la plataforma entera está construida alrededor de él. Se planifica como modo de exhibición sin guardado en `02-ultimo-rebote-extension.md`.
- **Sí:** escalera infinita de rivales con `rival` sin techo y dificultad creciente. Da el "hasta dónde llegas" que hace comparables dos partidas, igual que el nivel en asteroides o la ronda en `salta-charcos`.
- **No:** un único rival con dificultad fija y partida a 11 puntos. El score quedaría acotado y todas las partidas buenas empatarían arriba.
- **Sí:** ficha nueva `ultimo-rebote` insertada con `insert into public.games`. El flujo `game-jam` no reescribe fichas ajenas; `duelo-pixel` está en `references/implemented-games.md` como pendiente y podría recibir algún día un Pong 1v1 literal.
- **No:** reutilizar el id `duelo-pixel` con un `update ... set engine = 'pong'`, como hicieron SPEC 07/08/09 con sus fichas sembradas. Está prohibido reutilizar un id ya presente en el catálogo, y además el juego que describe su texto ("Modo solitario contra la CPU **o** partida local a dos jugadores") no es exactamente este.
- **Sí:** `id = 'ultimo-rebote'`, slug kebab-case en español, sin marcas de terceros, en la línea de `rocas` / `caida` / `bloque-buster` / `serpentina` / `salta-charcos`. "Último rebote" nombra la condición de fin: el duelo dura hasta que se te escapa la tercera pelota.
- **No:** ids del tipo `duelo-neon` o `paleta-infinita`. El primero se confunde visualmente con la ficha `duelo-pixel` ya existente; el segundo describe el objeto, no la tensión del juego.
- **Sí:** `engine = 'pong'`, id técnico que nombra el género. Coherente con `tetris`, `arkanoid`, `frogger`, `snake`: el motor se llama por la mecánica, no por el nombre de marketing de la ficha.
- **Sí:** `cover-duelo`, clase ya existente en `app/globals.css`. Dibuja exactamente este juego: línea central discontinua, paleta cyan a la izquierda, paleta magenta a la derecha y pelota amarilla. Ninguna otra cover del repo representa un duelo de paletas, y la spec no crea covers nuevas ni invoca `/frontend-design`.
- **Sí:** compartir `cover-duelo` con la ficha `duelo-pixel`. Ya hay precedente: `01-salta-charcos-mvp.md` reutiliza `cover-rana` que también usa `ranaria`. Dos fichas del mismo género comparten portada sin romper nada.
- **Sí:** `color = 'magenta'`. El catálogo tiene magenta infrautilizado (solo `caida`), la paleta rival del motor es magenta, y así la tarjeta no queda idéntica a la de `duelo-pixel`, que es cyan.
- **No:** `color = 'cyan'`. Habría dejado dos tarjetas VERSUS con la misma cover y el mismo color, indistinguibles en `/biblioteca`.
- **Sí:** `cat = 'VERSUS'`. Es la categoría más vacía del catálogo (solo `duelo-pixel`, sin motor) y el juego es un duelo, aunque el oponente sea IA.
- **No:** `cat = 'ARCADE'`. Habría sido defendible por el loop de supervivencia, pero deja VERSUS sin ningún juego jugable, que es justo el hueco que este tema puede llenar.
- **Sí:** tres estadísticas de HUD (Puntuación, Vidas, Rival) además de "Jugador", el máximo que permite `GameSnapshot`. Son los tres datos reales que el juego produce.
- **No:** añadir el marcador del duelo actual (`won` de 0 a 5) como cuarta `HudStat`. Excedería el máximo de tres del snapshot flexible; se dibuja en el canvas como pips, que es información efímera ligada a la escena y no texto de HUD.
- **Sí:** solo ↑ y ↓ como controles. Mismo criterio "un solo esquema de teclado" que los cinco motores anteriores; el segundo esquema (WASD para el jugador 2) solo tiene sentido con el modo local, que vive en la extensión.
- **No:** mouse o táctil para mover la paleta, aunque sea el control natural de un Pong moderno. La plataforma no lo admite en este flujo; el táctil llega, si llega, por el patrón de SPEC 10 con `mobile-porter` después de implementar.
- **Sí:** error de la IA sorteado una vez por rally, no por frame. Un error recalculado cada frame produce una paleta que tiembla; sorteado por rally, el rival parece decidir mal el golpe, que es lo que se busca.
- **No:** IA perfecta que sigue la `y` de la pelota sin error. Sería invencible, la partida nunca avanzaría de rival y el score se estancaría en devoluciones.
- **Sí:** la IA deriva al centro cuando la pelota se aleja. Evita que se quede pegada al último punto de impacto y hace los rebotes más legibles.
- **Sí:** puntos por devolución (10) además de por punto ganado (100) y rival derrotado (500). El componente por devolución premia los peloteos largos y evita que dos partidas con los mismos rivales derrotados empaten siempre.
- **No:** puntuar solo por rival derrotado. El score daría saltos de 500 y el HUD se sentiría muerto durante los peloteos.
- **Sí:** vidas que no se recuperan (3 para toda la partida). Mantiene la tensión creciente sin ninguna válvula de escape y hace corta la partida media.
- **No:** vidas que se reponen al derrotar a un rival. Alargaría las partidas hasta la fatiga; se planifica como mecánica de la extensión, con umbral y tope.
- **Sí:** retardo de saque de 700 ms con destello del lado que encajó. Da una señal clara de quién ha marcado sin dibujar texto en el canvas.
- **No:** saque inmediato tras el punto. Se pierde la lectura de qué acaba de pasar, sobre todo con la pelota a máxima velocidad.
- **Sí:** aumento de rapidez de la pelota por cada golpe de paleta, con techo `MAX_BALL_SPEED`. Es la escalada de tensión clásica del género; el techo evita que la pelota atraviese la paleta entre dos frames.
- **Sí:** `insertScore` desde `lib/scores-client.ts`, nunca desde `lib/scores.ts`, siguiendo la trampa documentada en la sección (e) del contrato de plataforma.
- **Sí:** todo el MVP sin assets externos, dibujado con formas vectoriales. El juego no necesita sprites y así no hay nada que mover a `public/games/`.
- **No:** power-ups, spin, personalidades de rival, jefes y racha con multiplicador en el MVP. No son el corazón del juego, pero tampoco se tiran: cada uno está planificado en `02-ultimo-rebote-extension.md` con su efecto en motor, snapshot, HUD y puntuación.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                  | Mitigación                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El bucle `requestAnimationFrame` o los listeners de teclado no se limpian al navegar y queda un bucle fantasma.         | `handle.destroy()` se llama en el cleanup del `useEffect`; cancela el rAF y retira `keydown` y `keyup`. Criterio de aceptación dedicado, verificado entrando y saliendo de la ruta dos veces.                                        |
| `preventDefault` de las flechas bloquea el scroll del resto de la página.                                               | Solo se aplica en fase `playing` o `serving`, nunca en pausa ni en `over`; los listeners se retiran al desmontar.                                                                                                                    |
| El timestep por frame haría correr la pelota a distinta velocidad según el framerate del monitor.                       | Todas las velocidades están en px/s y el `dt` se calcula en segundos con clamp a `0.05`, igual que los cinco motores anteriores.                                                                                                     |
| Next 16 trata `params` como `Promise` y `PageProps` es un global generado.                                              | `app/juego/[id]/jugar/page.tsx` ya usa `await params` y `PageProps<"/juego/[id]/jugar">`; esta spec solo añade una entrada al registro `ENGINES`. Revisar `node_modules/next/dist/docs/01-app/` antes de tocar el archivo.           |
| Assets externos con rutas relativas rotas tras mover el código a `lib/games/`.                                          | No aplica: este motor no usa ningún asset. Todo se dibuja con formas vectoriales; no se añade nada a `public/games/`.                                                                                                                |
| La pelota atraviesa la paleta entre dos frames (tunneling) al alcanzar velocidades altas.                               | `MAX_BALL_SPEED = 760` px/s frente a una paleta de 14 px de ancho y un `dt` clampado a `0.05` obliga a comprobar la colisión contra la **banda** horizontal de la paleta (posición anterior → posición nueva), no solo contra su rectángulo en el frame actual. Criterio de aceptación dedicado sobre la pelota que nunca queda atrapada. |
| La IA resulta invencible o trivial y el score se estanca en devoluciones o se dispara sin control.                      | `rivalSpeed` y `rivalError` son parámetros lineales con techo y suelo (`MAX_RIVAL_SPEED`, `MIN_RIVAL_ERROR`), ajustables en una sola constante; el paso 5 del plan exige jugar hasta el rival #3 antes de cerrar el motor.           |
| El score por devolución convierte el juego en "pelotear eternamente contra el rival #1" para farmear puntos.            | El rival sube de dificultad solo al perder puntos, pero el techo de rapidez de la pelota (`MAX_BALL_SPEED`) hace que un peloteo largo acabe siempre en punto; además `POINTS_POINT` y `POINTS_RIVAL` pesan 10 y 50 veces más que una devolución. |
| El marcador del duelo (`won`) no cabe como cuarta `HudStat` y el jugador pierde de vista cuánto le falta para el rival. | Se dibuja como pips en el canvas, información efímera ligada a la escena, con criterio de aceptación propio que verifica que se vacían al cambiar de rival.                                                                           |
| `onState` emitido en cada frame por el movimiento de las paletas satura React de renders.                               | El snapshot se emite solo cuando cambia `score`, `lives`, `rival` u `over`, comparando contra el último emitido — el movimiento de paletas y pelota nunca dispara `onState`.                                                         |
| Confusión en el catálogo entre `ultimo-rebote` y `duelo-pixel`, ambas VERSUS con `cover-duelo`.                          | Colores distintos (magenta vs cyan) y textos `short`/`long` que dejan claro que este es contra IA y acumulativo. Criterio de aceptación que verifica que `duelo-pixel` no cambia.                                                    |

---

## Lo que **no** entra en esta spec

- Modo 1v1 local a dos jugadores en el mismo teclado.
- Personalidades de rival, efecto/spin, power-ups y modificadores de duelo.
- Racha de devoluciones con multiplicador, vida extra y rival jefe.
- Dificultad progresiva avanzada (paleta que encoge, tabla de velocidades por rival).
- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- Sonido, controles táctiles, `devicePixelRatio`, skins o temas visuales.
- WASD o cualquier segundo esquema de teclado.
- `.cover-*` nueva, `/frontend-design`, cambios en `app/globals.css`, tests automatizados e i18n.

Los cuatro primeros puntos **sí** están planificados: van en `02-ultimo-rebote-extension.md`. El resto, si llega alguna vez, va en su propia spec.
