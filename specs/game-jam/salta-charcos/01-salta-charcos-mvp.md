# GAME JAM — SALTA CHARCOS (MVP)

> **Estado:** Borrador
> **Tema:** ranaria — un juego estilo Frogger-like (cruzar un camino/río esquivando obstáculos)
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-12
> **Objetivo:** Diseñar desde cero un motor de cruce por carriles (carretera + río) con saltos de celda, 3 vidas, reloj por cruce y 5 nichos por ronda, enchufado a una ficha nueva `salta-charcos` con leaderboard real en Supabase.

---

## 1 — Por qué existe esta spec

El tema recibido es `ranaria`: cruzar una autopista y un río esquivando obstáculos, al estilo Frogger. Es un tema con lectura arcade directa — loop corto (un cruce dura segundos), condición de fin clara (vidas a cero o reloj agotado) y puntuación natural y creciente (filas avanzadas + nichos alcanzados + bonus de tiempo). No hace falta reinterpretarlo para que puntúe.

El tema **sí** obliga a resolver una colisión con el catálogo existente: la ficha `ranaria` (ARCADE, `cover-rana`, verde, "Cruza la autopista de pixeles") ya está sembrada desde SPEC 06 y sigue sin motor, y `references/game-suggestions-todo.md` la tiene como fila `En espera` del 2026-09-12 con el veredicto literal _"Frogger-like, motor simple, pero la puntuación (score por cruces) necesita definirse mejor"_. Esta spec es, entre otras cosas, la respuesta a esa objeción: la sección 3 fija un modelo de puntuación completo (10 por fila nueva, 50 por nicho, bonus de tiempo, 500 por ronda) en vez de "score por cruces" a secas.

Aun así, el flujo `game-jam` no consume ni reescribe fichas ajenas: crea una ficha nueva con id propio (`salta-charcos`) mediante `insert`, y deja `ranaria` intacta. La convivencia de ambas fichas se decide en la sección 6.

No existe carpeta de referencia en `references/started-games/` para este juego: el motor se diseña desde cero, igual que SPEC 09 (Snake). Todo se dibuja con formas vectoriales sobre canvas, sin assets externos. Como en SPEC 05/07/08/09, no se usa `/frontend-design`: se reutiliza una `.cover-*` ya existente y las clases `.crt`, `.player-hud`, `.btn`, `.modal`, `.game-canvas`.

---

## 2 — Alcance

**Dentro:**

- Migración Supabase (`apply_migration`) con un **`insert`**, no un `update` — a diferencia de SPEC 07/08/09, que activaban el motor de una ficha ya sembrada, aquí el juego es nuevo y la ficha no existe:

  ```sql
  insert into public.games (id, title, short, long, cat, cover, color, best, plays, engine)
  values ('salta-charcos', 'SALTA CHARCOS', '...', '...', 'ARCADE', 'cover-rana', 'green', 0, '0', 'frogger');
  ```

  `best = 0` y `plays = '0'`. **Sin filas nuevas en `scores`**: el leaderboard de este juego arranca vacío hasta que alguien juegue de verdad. No hace falta `generate_typescript_types`: `games.engine` ya es `string | null` en `lib/supabase/types.ts`.

- `lib/games.ts`: el union `engine?: "asteroids" | "tetris" | "arkanoid" | "snake"` pasa a incluir `| "frogger"`, **en los tres sitios** — la interfaz `Game` y los dos casts literales `(g.engine as ... | null) ?? undefined` de `getGames()` y `getGameById()`.
- `lib/games/frogger/engine.ts`: motor nuevo, DOM puro, sin importar nada de `react` ni de `next/*`.
  - Constantes puras a nivel de módulo: `GAME_W = 800`, `GAME_H = 600`, `CELL = 50` (grid de 16 columnas × 12 filas), `START_COL = 8`, `START_ROW = 11`, `LIVES = 3`, `CROSS_TIME_S = 30`, `HOP_MS = 90`, `DEATH_FLASH_MS = 500`, `NEST_COLS = [1, 4, 7, 10, 13]`, `POINTS_ROW = 10`, `POINTS_NEST = 50`, `POINTS_PER_TIME_SECOND = 10`, `POINTS_ROUND = 500`, `ROUND_SPEED_STEP = 0.12`, `MAX_SPEED_MULT = 2.2`, y la tabla `LANES` (definición estática de los 8 carriles: fila, tipo, dirección, velocidad base en px/s, patrón de huecos y anchos).
  - Disposición fija del tablero por fila: fila 0 = orilla de nidos (5 nichos en `NEST_COLS`, el resto de celdas son juncos sólidos), filas 1–4 = río (4 carriles de troncos y nenúfares), fila 5 = mediana segura, filas 6–9 = carretera (4 carriles de vehículos), filas 10–11 = orilla de salida (seguras; la rana aparece en la fila 11).
  - Todo el estado de partida vive dentro de `createFroggerGame(canvas, opts)`: posición de la rana (celda + desplazamiento en píxeles mientras flota sobre un tronco), animación de salto en curso, fila máxima alcanzada en la vida actual, `score`, `lives`, `round`, nichos ocupados, reloj del cruce, desplazamiento de cada carril, y fase `playing | dying | over`.
  - `opts`: `{ onState: (s: FroggerSnapshot) => void }`.
  - Devuelve un `FroggerHandle` con `start()`, `pause()`, `resume()`, `restart()`, `end()`, `destroy()`, misma forma que los cuatro motores anteriores.
  - **Movimiento del jugador por salto discreto de celda.** Cada pulsación de flecha encola un salto de una celda; el salto se interpola durante `HOP_MS` y, mientras dura, se ignoran nuevas pulsaciones (no se acumula una cola de saltos). No se puede salir del tablero por los laterales ni por la fila 11: el salto que sacaría a la rana del grid simplemente no se ejecuta.
  - **Movimiento de los carriles continuo, en px/s.** Cada carril desplaza sus elementos a `velocidadBase × multiplicadorDeRonda` píxeles por segundo, con wrap-around: el elemento que sale por un borde reaparece por el opuesto. El bucle es `requestAnimationFrame` con `dt` en segundos y clamp a `0.05`, igual que los cuatro motores anteriores.
  - **Carretera (filas 6–9).** Si el rectángulo de la rana se solapa con el de un vehículo (AABB), la fase pasa a `dying`.
  - **Río (filas 1–4).** Si la rana está en una fila de río y **no** se solapa con ningún tronco o nenúfar, se ahoga (fase `dying`). Si está sobre uno, se desplaza con él a la velocidad del carril; si el arrastre la saca del borde del canvas, también muere.
  - **Nichos (fila 0).** Saltar a una celda de `NEST_COLS` libre ocupa ese nicho, suma `POINTS_NEST` más `segundos restantes × POINTS_PER_TIME_SECOND`, devuelve la rana a la casilla de salida y reinicia el reloj. Saltar a un nicho ya ocupado o a una celda de juncos es muerte.
  - **Ronda.** Con los 5 nichos ocupados: `score += POINTS_ROUND`, `round += 1`, se vacían los nichos y el multiplicador de velocidad sube `ROUND_SPEED_STEP` con techo `MAX_SPEED_MULT`. El reloj vuelve a `CROSS_TIME_S`.
  - **Reloj.** Cada cruce dispone de `CROSS_TIME_S` segundos; al llegar a 0, la fase pasa a `dying`. Se reinicia al empezar cada rana nueva y tras ocupar un nicho. Se dibuja como una barra en el canvas, **no** se expone en el snapshot (ver sección 6).
  - **Muerte y fin.** En `dying` los carriles siguen moviéndose pero la rana queda congelada y parpadea durante `DEATH_FLASH_MS`; al terminar, `lives -= 1`. Si quedan vidas, la rana reaparece en la casilla de salida con el reloj y la fila máxima reiniciados; si no, la fase pasa a `over` y se emite el snapshot final con `over: true`.
  - **Puntos por avance.** La primera vez que la rana alcanza una fila más alta que cualquier otra de su vida actual, suma `POINTS_ROW`. Retroceder y volver a subir no vuelve a puntuar.
  - `start()` ata el listener `keydown` (4 flechas) y arranca el `requestAnimationFrame`; se dispara al montar el wrapper, sin pantalla de inicio propia. `preventDefault` solo actúa en fase `playing` o `dying`, nunca en `over` ni en pausa.
  - `pause()` cancela el rAF; `resume()` pone `lastTime = null` para no arrastrar el tiempo de la pausa ni en los carriles ni en el reloj del cruce.
  - `restart()` reinicia en caliente (rana en la salida, `score` 0, `lives` 3, `round` 1, nichos vacíos, multiplicador a 1) sin recrear el handle. `end()` fuerza la fase `over` con el estado actual.
  - Dibujo vectorial: bandas de fondo por zona (asfalto, agua, orillas), vehículos como rectángulos de neón con color por carril, troncos y nenúfares como bloques redondeados, rana como cuadrado verde con ojos y ligera deformación durante el salto, nichos como huecos con brillo (los ocupados muestran una rana apagada). Sin HUD de texto en el canvas ni overlay de "GAME OVER": lo único dibujado que no es escena pura es la barra del reloj del cruce, información efímera ligada a la partida (mismo criterio que los temporizadores de power-up de asteroides o el parpadeo de muerte de Snake).
  - `onState(snapshot)` se emite solo cuando cambia `score`, `lives`, `round` o `over` — nunca por frame y nunca por tick del reloj.
- `lib/games/types.ts`: **sin cambios**. `HudStat` y `GameSnapshot` ya existen desde SPEC 07 y cubren este juego; `FroggerSnapshot` los extiende desde el propio motor.
- `app/_components/games/frogger-game.tsx` (`"use client"`): wrapper de React, calcado de `snake-game.tsx`.
  - `<canvas className="game-canvas">` de 800×600 dentro de `.crt` / `.crt-screen` / `.crt-bottom`.
  - `.player-hud` con `.hud-stat`: Jugador, Puntuación, Vidas, Ronda.
  - Nombre de jugador con `useState("INVITADO")` + `useEffect` sobre `useSession().user` (se hidrata desde `localStorage` después del montaje, nunca se lee una sola vez).
  - Botones `.btn` PAUSA/REANUDAR (`yellow`), FIN (`magenta`), SALIR (`ghost`, `router.push("/juego/salta-charcos")`), más el listener propio de `KeyP` y `Escape` para alternar pausa por el mismo camino que el botón.
  - Modal `.modal-bd > .modal` "FIN DEL JUEGO" con su ciclo `saving / saved / saveError`: `insertScore({ gameId: game.id, name, score })` importado de `lib/scores-client.ts` (**nunca** de `lib/scores.ts`), toast `.toast-saved` para el éxito y el mismo elemento en magenta para el error inline, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`.
- `app/juego/[id]/jugar/page.tsx`: se añade `frogger: FroggerGame` al registro `ENGINES` ya existente (`{ asteroids, tetris, arkanoid, snake }`). La página sigue siendo Server Component con `await params` y `PageProps<"/juego/[id]/jugar">`.
- **Sin cambios en `app/globals.css`**: se reutiliza `cover-rana` (ya existe) y el canvas de 800×600 encaja exacto en el `aspect-ratio: 4 / 3` que `.game-canvas` ya fija.
- `npm run lint` y `npm run build` en verde.

**Fuera de alcance (planificado en `02-salta-charcos-extension.md`):**

- Tortugas sumergibles que hunden a la rana si tarda encima.
- Cocodrilos (nadadores en el río y ocupando nichos), serpientes en la mediana y sobre los troncos.
- Mosca bonus y rana acompañante transportable como objetivos extra de puntuación.
- Racha de cruces sin morir con multiplicador de puntuación.
- Vida extra al superar un umbral de puntuación.
- Dificultad progresiva avanzada: patrones de carril distintos por ronda, reloj del cruce que se acorta, vehículos de anchos variables por ronda.
- Modo contrarreloj y variantes visuales de escenario.

**Fuera de alcance (exclusiones vigentes de SPEC 05/06, no se tocan aquí):**

- Sin auth real: el nombre del jugador sigue saliendo del `localStorage` de `session-provider`.
- Sin contador de `plays` real: la columna se inserta como texto estático `'0'`.
- Sin rate limiting ni validación de servidor en el `insert` de puntuaciones.
- Sin realtime en el leaderboard: `/salon` sigue actualizándose al recargar.
- Sin sonido, sin controles táctiles o de móvil, sin `devicePixelRatio` ni resolución dinámica.
- Sin WASD ni ningún segundo esquema de teclado: solo flechas, mismo criterio que los cuatro motores anteriores.
- Sin pausa automática al perder el foco de la pestaña.
- Sin tests automatizados (no hay runner configurado), sin i18n, sin `/frontend-design` ni `.cover-*` nueva.

---

## 3 — Modelo de datos

### Ficha nueva en Supabase

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, engine)
values (
  'salta-charcos',
  'SALTA CHARCOS',
  'Cruza el pantano de neón sin acabar en el agua.',
  'Cuatro carriles de tráfico y cuatro de corriente separan a tu rana de los cinco nichos de la orilla alta. Salta celda a celda entre los huecos del tráfico, móntate en los troncos que arrastra el río y llega arriba antes de que se agote el reloj. Cinco nichos ocupados cierran la ronda y aceleran todo el pantano.',
  'ARCADE',
  'cover-rana',
  'green',
  0,
  '0',
  'frogger'
);
```

No se inserta ninguna fila en `scores`: el leaderboard de `salta-charcos` arranca vacío.

### Campo `engine` ampliado en `lib/games.ts`

```ts
export interface Game {
  // ...campos existentes...
  engine?: "asteroids" | "tetris" | "arkanoid" | "snake" | "frogger";
}
```

Los dos casts de `getGames()` y `getGameById()` se amplían con el mismo union.

### Snapshot y handle del motor (`lib/games/frogger/engine.ts`)

```ts
import type { GameSnapshot } from "@/lib/games/types";

export interface FroggerSnapshot extends GameSnapshot {
  lives: number; // vidas restantes, empieza en LIVES = 3
  round: number; // ronda actual, empieza en 1
}

export interface FroggerHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: FroggerSnapshot) => void }
): FroggerHandle;
```

`stats` se construye dentro del motor en cada emisión: `[{ l: "Puntuación", v: String(score) }, { l: "Vidas", v: String(lives) }, { l: "Ronda", v: String(round) }]` — tres `HudStat` además de "Jugador", el máximo permitido por el contrato.

### Definición de carriles

```ts
type LaneKind = "road" | "river";

interface Lane {
  row: number; // 1..4 río, 6..9 carretera
  kind: LaneKind;
  dir: 1 | -1; // 1 = hacia la derecha
  speed: number; // px/s a multiplicador de ronda 1
  widthCells: number; // ancho de cada elemento en celdas
  gapCells: number; // hueco entre elementos, en celdas
  offset: number; // desfase inicial del patrón, en píxeles
}

const LANES: readonly Lane[] = [
  /* 8 entradas fijas: 4 de río (filas 1-4) y 4 de carretera (filas 6-9) */
];
```

Convenciones:

- Origen arriba-izquierda. Mundo fijo de 800×600 px, celdas cuadradas de `CELL = 50` (16 columnas × 12 filas), encaje exacto en 4/3 sin tocar `.game-canvas`.
- La rana se guarda como `{ col, row, px }`, donde `px` es el desplazamiento horizontal en píxeles respecto al centro de la celda mientras flota sobre un tronco; al saltar, `px` se reabsorbe redondeando a la celda de destino más cercana.
- Los carriles se mueven en píxeles por segundo a partir de `dt` en segundos con clamp `0.05`; el jugador se mueve por saltos discretos interpolados en `HOP_MS`.
- Colisiones por AABB entre el rectángulo de la rana y los rectángulos de vehículos o plataformas, con tolerancia de 4 px por lado para que el borde exacto no mate.
- El motor recibe un `HTMLCanvasElement` y no importa nada de `react` ni de `next/*`. El wrapper es la única isla `"use client"` nueva.
- Sin assets externos: todo se dibuja con formas vectoriales, no hay nada que mover a `public/games/`.

---

## 4 — Plan de implementación

1. **Ficha y campo de datos.** Migración Supabase con el `insert` de la sección 3. En `lib/games.ts`, ampliar el union `engine` en los tres sitios (interfaz + los dos casts). Verificación: `npx tsc --noEmit` compila; `select id, engine from games where id = 'salta-charcos'` devuelve la fila con `engine = 'frogger'`; `select count(*) from scores where game_id = 'salta-charcos'` devuelve 0; `/biblioteca` muestra la tarjeta nueva y `/juego/salta-charcos/jugar` aún cae en el reproductor falso `<GamePlayer>`.
2. **Motor — tablero, carriles y dibujo estático.** Crear `lib/games/frogger/engine.ts` con las constantes, la tabla `LANES` y `createFroggerGame(canvas, opts)` con el estado encapsulado. Implementar `start()`/`destroy()` (arranca y cancela el rAF, todavía sin teclado), el avance de los carriles con wrap-around y `draw()` (bandas de zona, vehículos, troncos, nichos vacíos y rana parada en la salida). Verificación: `npx tsc --noEmit`; montado en una página de prueba, los carriles se desplazan de forma continua y estable, la rana se ve en la fila 11 y nada se mueve a saltos.
3. **Salto, colisiones y muerte.** Añadir el listener `keydown` de las 4 flechas atado en `start()` y retirado en `destroy()`, con `preventDefault` solo en `playing`/`dying`, el salto interpolado de `HOP_MS` con bloqueo de entrada durante el salto, el arrastre sobre troncos, la detección AABB de vehículos, el ahogamiento en río sin plataforma, la salida por arrastre fuera del canvas y la fase `dying` con parpadeo de `DEATH_FLASH_MS` seguida de respawn o de `over`. Verificación: `npx tsc --noEmit`; en la página de prueba, la rana salta celda a celda, un coche la mata, el agua la ahoga, un tronco la transporta y llevarla contra el borde también la mata.
4. **Nichos, reloj, puntuación y ronda.** Añadir los nichos de la fila 0 (ocupar, nicho repetido y juncos como muerte), el reloj de `CROSS_TIME_S` con su barra dibujada en el canvas, los puntos por fila nueva / nicho / bonus de tiempo / ronda completa, el vaciado de nichos y la subida del multiplicador de velocidad por ronda. Implementar `pause()`/`resume()` (sin arrastre de tiempo en carriles ni reloj), `restart()` y `end()`, y `emitState()` con diff sobre `score`/`lives`/`round`/`over`. Verificación: `npx tsc --noEmit`; jugar manualmente: llegar a los 5 nichos sube la ronda y acelera todo, el reloj agotado cuesta una vida, y `onState` no se dispara en frames sin cambios (comprobable con un `console.count` temporal).
5. **Wrapper — canvas y HUD.** Crear `app/_components/games/frogger-game.tsx` (`"use client"`) con `.crt`/`.crt-screen`/`.crt-bottom`, el `<canvas className="game-canvas">`, el `useEffect` que crea el handle, llama `start()` y hace `destroy()` en el cleanup, la `.player-hud` con Jugador/Puntuación/Vidas/Ronda, los botones PAUSA/REANUDAR, FIN y SALIR, y la escucha de `KeyP`/`Escape`. Verificación: `npx tsc --noEmit`; el componente monta sin romper el render de servidor y los cuatro `.hud-stat` reflejan el snapshot.
6. **Wrapper — modal de fin y guardado.** Añadir el modal "FIN DEL JUEGO" con `insertScore` de `lib/scores-client.ts`, toast de guardado, error inline en magenta reutilizando `.toast-saved`, JUGAR DE NUEVO → `handle.restart()` y VOLVER AL VAULT → `router.push("/biblioteca")`. Verificación: perder las 3 vidas o pulsar FIN abre el modal; GUARDAR crea una fila en `scores` (comprobable con `execute_sql`).
7. **Registro `engine → componente`.** Añadir `frogger: FroggerGame` al objeto `ENGINES` de `app/juego/[id]/jugar/page.tsx`, sin tocar la firma de la página (revisar antes `node_modules/next/dist/docs/01-app/` si hace falta refrescar la convención de `params`). Verificación: `/juego/salta-charcos/jugar` muestra el canvas jugable; `rocas`, `caida`, `bloque-buster` y `serpentina` siguen igual.
8. **CSS.** Ningún cambio en `app/globals.css`. Verificación: `git diff --stat app/globals.css` vacío y la tarjeta de `salta-charcos` se ve con la portada `cover-rana` en `/biblioteca`.
9. **Cierre.** `npm run lint` y `npm run build` en verde. Repaso manual en `/juego/salta-charcos/jugar`: completar una ronda entera, morir de las tres formas (coche, agua, reloj), guardar la puntuación y comprobar que aparece en `/salon` (pestaña SALTA CHARCOS) tras recargar.

---

## 5 — Criterios de aceptación

**Del juego:**

- [ ] La ficha `salta-charcos` existe en `public.games` con `cat = 'ARCADE'`, `cover = 'cover-rana'`, `color = 'green'`, `best = 0`, `plays = '0'` y `engine = 'frogger'`.
- [ ] La tabla `scores` no tiene ninguna fila con `game_id = 'salta-charcos'` hasta que se guarde una puntuación jugando.
- [ ] La ficha `ranaria` sigue sin `engine` y con sus textos originales sin cambios.
- [ ] `/juego/salta-charcos/jugar` renderiza un `<canvas>` de 800×600 jugable dentro del marco `.crt`; las 4 flechas mueven la rana exactamente una celda por pulsación.
- [ ] Mantener pulsada una flecha o pulsarla varias veces durante un salto no encola saltos: la rana avanza una celda por salto completado.
- [ ] La rana no puede salir del tablero por los laterales ni por debajo de la fila 11.
- [ ] Tocar un vehículo en cualquiera de las 4 filas de carretera cuesta una vida.
- [ ] Caer al agua en cualquiera de las 4 filas de río, sin tronco ni nenúfar debajo, cuesta una vida.
- [ ] Sobre un tronco, la rana se desplaza con él; si el arrastre la saca por un borde del canvas, cuesta una vida.
- [ ] Alcanzar por primera vez una fila más alta que cualquier otra de la vida actual suma 10 puntos; bajar y volver a subir no vuelve a sumar.
- [ ] Llegar a un nicho libre suma 50 puntos más 10 por segundo restante del reloj, ocupa el nicho visualmente y devuelve la rana a la casilla de salida con el reloj reiniciado.
- [ ] Saltar a un nicho ya ocupado o a una celda de juncos cuesta una vida.
- [ ] Ocupar los 5 nichos suma 500 puntos, vacía los nichos, sube el stat "Ronda" en 1 y acelera de forma perceptible todos los carriles.
- [ ] Agotar el reloj del cruce cuesta una vida y reinicia el reloj para la rana siguiente.
- [ ] Perder la tercera vida abre el modal "FIN DEL JUEGO" tras el parpadeo de muerte.
- [ ] La barra `.player-hud` muestra Jugador, Puntuación, Vidas y Ronda, alimentados por el snapshot del motor (no por `setInterval`).
- [ ] El reloj del cruce se ve como una barra dentro del canvas y no aparece como `.hud-stat`.
- [ ] PAUSA (o `P`/`Escape`) congela carriles, rana y reloj; REANUDAR continúa sin que los carriles salten ni el reloj descuente el tiempo de la pausa.

**Invariantes de plataforma (sección (g) del contrato):**

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `lib/games/frogger/engine.ts` no importa nada de `react` ni de `next/*`.
- [ ] La ficha existe en `public.games` con su `engine` correspondiente y ninguna otra ficha lleva `engine = 'frogger'` por error.
- [ ] `/juego/salta-charcos/jugar` responde a los controles definidos en esta spec (solo flechas).
- [ ] Guardar una puntuación desde el modal la hace aparecer en `/salon` (pestaña SALTA CHARCOS) tras recargar la página.
- [ ] Si el `insert` de la puntuación falla, se muestra un error inline en el modal sin perder la partida ni navegar fuera.
- [ ] `insertScore` se importa de `lib/scores-client.ts` y en ningún punto del árbol cliente se importa `lib/scores.ts`.
- [ ] Al navegar fuera de `/juego/salta-charcos/jugar` no quedan bucles de `requestAnimationFrame` ni listeners de teclado vivos (verificable en el rendimiento y en la consola; entrar y salir dos veces no duplica la velocidad de los carriles).
- [ ] `preventDefault` de las flechas solo actúa en partida activa: en pausa o con el modal abierto, las flechas siguen haciendo scroll de la página.
- [ ] `app/juego/[id]/jugar/page.tsx` usa el registro `ENGINES` ampliado con `frogger: FroggerGame`; los cuatro juegos reales anteriores siguen funcionando sin cambios de comportamiento.
- [ ] Los juegos sin `engine` (`duelo-pixel`, `gloton`, `invasores`, `ranaria`) siguen mostrando `<GamePlayer>` sin cambios.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** interpretar `ranaria` como un Frogger-like literal (carretera + río + nichos), sin reinterpretación. El tema ya trae loop corto, fin claro y puntuación creciente; forzar una lectura "original" habría sido inventar problemas.
- **Sí:** ficha nueva con id `salta-charcos`, insertada con `insert into public.games`. El flujo `game-jam` diseña juegos nuevos y no puede reutilizar un id ya presente en `lib/games.ts` ni en `references/implemented-games.md`.
- **No:** reutilizar la ficha `ranaria` con un `update` (el patrón de SPEC 07/08/09). El id está tomado y su ficha pertenece a la línea de trabajo numerada; si al promover esta spec se decide fusionar ambas, convertir el `insert` en un `update set engine = 'frogger'` sobre `ranaria` es un cambio de una línea, pero es una decisión del usuario, no de esta spec.
- **Sí:** citar la fila `En espera` de `ranaria` en `references/game-suggestions-todo.md` (2026-09-12, _"la puntuación (score por cruces) necesita definirse mejor"_) y responderla con el modelo de puntuación de la sección 3. Ese archivo es memoria de `game-planner` y esta spec solo lo lee.
- **Sí:** `title` "SALTA CHARCOS", sin nombres ni marcas de terceros, siguiendo el precedente de `rocas`, `caida`, `bloque-buster` y `serpentina`.
- **Sí:** `engine: "frogger"` como id técnico del motor. Nombra el género, no el marketing de la ficha — mismo criterio con el que `caida` usa `engine: "tetris"` y `bloque-buster` usa `engine: "arkanoid"`.
- **No:** `engine: "salta-charcos"` o `engine: "rana"`. Habría roto la convención de nombrar el género en la clave del registro `ENGINES`.
- **Sí:** `cover-rana`, una clase ya existente en `app/globals.css`. Su arte es literalmente este juego: bandas horizontales cian (carriles/corriente) con un círculo verde centrado (la rana cruzando). Ninguna otra `.cover-*` del repo describe un cruce por carriles.
- **No:** crear una `.cover-*` nueva o pasar por `/frontend-design`. Está prohibido en este flujo, y además sería trabajo de diseño para un arte que ya existe.
- **Riesgo asumido:** `cover-rana` la comparte la ficha `ranaria`, así que en `/biblioteca` habría dos tarjetas con la misma portada mientras ambas fichas convivan. Se acepta a cambio de no crear CSS nuevo; la sección 7 lo recoge como riesgo y la fusión de fichas lo resolvería.
- **Sí:** `cat = ARCADE`. Es reflejos y ejecución bajo reloj, no razonamiento (PUZZLE), no disparo (SHOOTER), no 1v1 (VERSUS).
- **Sí:** `color = green`. El arte de `cover-rana` dibuja la rana en `var(--green)` y el glow verde de la tarjeta es el único que no desentona con esa portada.
- **No:** `color = magenta` (el color menos usado del catálogo). Habría dado variedad al catálogo a costa de chocar con el verde de la portada reutilizada.
- **Sí:** grid de 16×12 celdas de 50 px sobre un mundo de 800×600. Encaja exacto en el `aspect-ratio: 4 / 3` de `.game-canvas`, así que no hace falta tocar `app/globals.css` — mismo truco de encaje que SPEC 09.
- **No:** un tablero más alto tipo arcade original (proporción vertical). Habría obligado a una clase de canvas nueva o a letterboxing, decisión que el contrato pide evitar cuando el 4/3 basta.
- **Sí:** salto discreto de una celda por pulsación, interpolado en `HOP_MS = 90` y con la entrada bloqueada mientras dura. Es la mecánica que define el género; sin el bloqueo, mantener pulsada una flecha cruzaría el tablero de golpe.
- **No:** movimiento continuo con flechas mantenidas. Convertiría el juego en un runner y haría imposible medir los huecos del tráfico.
- **Sí:** carriles en movimiento continuo en px/s (no por celdas). Los huecos del tráfico dejan de estar alineados al grid, que es justo lo que obliga a cronometrar el salto.
- **Sí:** 3 vidas más reloj de 30 s por cruce como doble condición de presión. Las vidas dan la condición de fin y el reloj impide la partida eterna de quien espera el hueco perfecto.
- **No:** una sola vida (muerte súbita). Con tráfico y río encadenados, la partida media duraría segundos y el leaderboard mediría suerte, no habilidad.
- **Sí:** el reloj del cruce se dibuja como barra en el canvas y **no** entra en el snapshot. Es información efímera ligada a la escena (igual que los temporizadores de power-up de asteroides) y meterlo en el HUD obligaría a emitir un snapshot por segundo, rompiendo el `emitState()` con diff.
- **No:** un cuarto `.hud-stat` con el tiempo. Excedería el máximo de 3 stats además de "Jugador" que fija el contrato.
- **Sí:** HUD con Puntuación, Vidas y Ronda. Son los tres datos discretos y reales que el juego produce.
- **Sí:** puntuación por fila nueva máxima alcanzada en la vida actual (10 puntos), no por cada salto hacia arriba. Evita farmear puntos subiendo y bajando en la orilla segura — la objeción exacta que `game-planner` dejó anotada sobre este juego.
- **Sí:** bonus de tiempo al ocupar un nicho (`segundos restantes × 10`). Premia el cruce arriesgado y rápido frente al que espera a que todo esté despejado.
- **Sí:** subida de velocidad global del `12 %` por ronda con techo `MAX_SPEED_MULT = 2.2`. Es dificultad progresiva mínima para que la partida termine; sin techo, la ronda 15 sería injugable por motivos de framerate, no de habilidad.
- **No:** patrones de carril distintos por ronda y reloj decreciente. Es dificultad progresiva avanzada y va a `02-salta-charcos-extension.md`.
- **Sí:** dibujo 100 % vectorial, sin assets. No hay material de origen para este tema y evita el paso de mover ficheros a `public/games/`.
- **No:** tortugas sumergibles, cocodrilos, serpientes, mosca bonus y rana acompañante en el MVP. Son las mecánicas que dan variedad, pero el juego ya es divertido y publicable sin ellas; van a la spec de extensión, no al cajón de "fuera de alcance".
- **Sí:** solo flechas como esquema de control. Mismo criterio "un solo esquema de teclado" que los cuatro motores anteriores.
- **Sí:** `insertScore` desde `lib/scores-client.ts`, nunca desde `lib/scores.ts`, siguiendo la trampa documentada en la sección (e) del contrato de plataforma.
- **Sí:** nombre del jugador con `useState("INVITADO")` + `useEffect` sobre `useSession().user`, no lectura directa. El usuario se hidrata desde `localStorage` después del montaje.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                   | Mitigación                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El bucle `requestAnimationFrame` o el listener de teclado no se limpian al navegar y queda un bucle fantasma.            | `destroy()` cancela el rAF y quita el `keydown`; se llama en el cleanup del `useEffect`. Criterio de aceptación dedicado: entrar y salir dos veces no duplica la velocidad de los carriles.                       |
| `preventDefault` de las flechas bloquea el scroll del resto de la página.                                                | Solo se aplica en fase `playing`/`dying`, nunca en pausa ni con el modal abierto; el listener se retira al desmontar.                                                                                             |
| El timestep por frame haría correr los carriles a distinta velocidad según el framerate del monitor.                     | Todo el movimiento de carriles y el reloj usan `dt` en segundos con clamp a `0.05`, igual que los cuatro motores anteriores; el salto del jugador se interpola por tiempo, no por frames.                         |
| `params` es una `Promise` y `PageProps` es un global generado en Next 16.                                                | `app/juego/[id]/jugar/page.tsx` ya usa `await params` y `PageProps<"/juego/[id]/jugar">`; esta spec solo añade una entrada al registro `ENGINES`. Revisar `node_modules/next/dist/docs/01-app/` antes de tocarla. |
| Assets con rutas relativas rotas tras mover código a `lib/games/`.                                                       | No aplica: el motor no usa ningún asset externo, todo es dibujo vectorial. Si en el futuro se añaden sprites, irían a `public/games/salta-charcos/` con ruta absoluta.                                            |
| `cover-rana` la comparte la ficha `ranaria`: en `/biblioteca` se verían dos tarjetas con la misma portada.               | Se acepta conscientemente (no se crea CSS nuevo). Si molesta, se resuelve fusionando ambas fichas al promover la spec o asignando otra `.cover-*` existente, no diseñando una nueva.                              |
| El juego se percibe como duplicado del hueco ya reservado por la ficha `ranaria`.                                        | La sección 6 documenta la convivencia y la alternativa de fusión; la decisión se toma al promover la spec, antes de implementar.                                                                                  |
| El arrastre sobre troncos acumula error de redondeo y la rana queda desalineada del grid tras varios saltos encadenados. | La rana guarda `{ col, row, px }` y cada salto redondea al centro de la celda de destino; el desplazamiento `px` se reabsorbe en ese redondeo en vez de acumularse.                                               |
| Un patrón de carriles mal calibrado hace el cruce imposible (huecos que nunca se alinean) o trivial.                     | La tabla `LANES` es estática y se calibra a mano en el paso 4 del plan, jugando la ronda 1 completa antes de conectar el wrapper; velocidades y huecos son constantes de módulo, fáciles de ajustar.              |
| El reloj del cruce, si entrara en el snapshot, dispararía un render por segundo y saturaría React.                       | El reloj se dibuja en el canvas y no forma parte de `FroggerSnapshot`; `emitState()` solo emite al cambiar `score`, `lives`, `round` u `over`.                                                                    |
| La aceleración por ronda sin techo vuelve el juego injugable y convierte el leaderboard en una lotería de framerate.     | `MAX_SPEED_MULT = 2.2` acota el multiplicador; la dificultad por encima de ese punto la aportan las mecánicas de la spec de extensión, no más velocidad.                                                          |
| Morir por tocar el píxel exacto del borde de un vehículo se percibe como injusto.                                        | La colisión AABB aplica una tolerancia de 4 px por lado en el rectángulo de la rana; se valida a mano en el paso 3 del plan.                                                                                      |

---

## Lo que **no** entra en esta spec

- Tortugas sumergibles, cocodrilos, serpientes, mosca bonus y rana acompañante.
- Racha de cruces sin morir con multiplicador, y vida extra por puntuación.
- Patrones de carril por ronda, reloj decreciente y anchos de vehículo variables.
- Modo contrarreloj y variantes visuales de escenario.

Todo lo anterior está planificado en **`02-salta-charcos-extension.md`**, que se implementa solo después de que esta spec esté en verde.

- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- Sonido, controles táctiles, `devicePixelRatio`, WASD, pausa automática al perder el foco.
- `/frontend-design`, `.cover-*` nuevas, rediseño del marco del reproductor, tests automatizados e i18n.

Cada uno de esos puntos, si llega, va en su propia spec.
