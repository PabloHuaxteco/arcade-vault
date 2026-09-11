# SPEC 09 — Juego de Snake real para la ficha `serpentina`

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-11
> **Objetivo:** Diseñar y enchufar un motor real de Snake (grid, frutas, crecimiento y velocidad progresiva) a la ficha `serpentina` existente, usando el atlas de frutas de `references/source-assets/snake-assets/` y añadiendo una cuarta entrada al registro `engine → componente` de `app/juego/[id]/jugar/page.tsx`.

---

## 1 — Por qué existe esta spec

SPEC 05, 07 y 08 dejaron tres juegos reales (`rocas`/asteroids, `caida`/tetris, `bloque-buster`/arkanoid) y cinco fichas con el reproductor falso `<GamePlayer>`. Entre ellas está `serpentina` (ARCADE, `cover-snake`, verde), cuyo texto actual ("Crece sin morder tu propia cola" / "Una serpiente de luz recorre la grilla buscando núcleos magenta...") ya describe un Snake clásico — es la ficha reservada para este motor, igual que `bloque-buster` lo estaba para Arkanoid.

A diferencia de los tres motores anteriores, **no existe una carpeta de referencia** (`references/started-games/`) para portar: este motor se diseña desde cero siguiendo la mecánica estándar de Snake, apoyado en el único material de origen disponible: `references/source-assets/snake-assets/`, que trae `fruits.png` (spritesheet de 21 frutas, 3790×442px, fondo transparente) y `sprites.js` (atlas de coordenadas `{x, y, w, h}` por fruta, todas de 160px de alto en la fila y=136–295). No hay sprite de serpiente en ese material: el cuerpo se dibuja con formas vectoriales (bloques con brillo neón verde), igual que asteroides y arkanoid dibujan sus propias formas sin depender de un sprite para todo.

Como en SPEC 05/07/08, no se usa `/frontend-design`: `cover-snake` ya existe y encaja, y se reutilizan `.crt`, `.player-hud`, `.btn`, `.modal`, `.game-canvas`.

---

## 2 — Alcance

**Dentro:**

- `references/source-assets/snake-assets/fruits.png` se mueve a `public/games/snake/fruits.png` (ruta absoluta, sirviendo el asset desde `public/` como en SPEC 08 con el spritesheet de arkanoid). `sprites.js` no se copia tal cual: sus coordenadas se tipan como una constante TypeScript dentro del motor (`FRUIT_ATLAS`), siguiendo la trampa documentada en `contrato-plataforma.md` (f.7 y f.8).
- `lib/games.ts`: el union `engine?: "asteroids" | "tetris" | "arkanoid"` pasa a `engine?: "asteroids" | "tetris" | "arkanoid" | "snake"`, actualizando los dos casts literales (`getGames()` y `getGameById()`) para incluir `"snake"`.
- Migración Supabase (`apply_migration`):
  - `update public.games set engine = 'snake' where id = 'serpentina';` — no es un `insert`, la ficha ya existe desde el seed de SPEC 06.
  - `update public.games set long = '<texto nuevo>' where id = 'serpentina';` — se reescribe el texto largo para mencionar frutas reales en vez de "núcleos magenta", ya que ahora el motor usa el atlas de frutas. `title`, `short`, `cat`, `cover`, `color`, `best`, `plays` no se tocan.
- `lib/games/snake/engine.ts`: motor nuevo, DOM puro.
  - Constantes puras a nivel de módulo: `GAME_W = 800`, `GAME_H = 600`, `CELL = 40` (grid resultante: 20 columnas × 15 filas), `INITIAL_INTERVAL_MS = 150`, `SPEED_STEP_MS = 10`, `MIN_INTERVAL_MS = 60`, `FRUITS_PER_SPEEDUP = 5`, `FRUIT_ATLAS` (las 21 entradas `{x, y, w, h}` de `sprites.js`, tipadas), `BLINK_DURATION_MS = 400`.
  - Todo el estado de partida (segmentos de la serpiente, dirección actual/pendiente, fruta activa y su tipo, acumulador de tiempo, `score`, frutas comidas, `speedTier`, fase `playing | dying | over`) vive dentro de una fábrica `createSnakeGame(canvas, opts)`.
  - `opts`: `{ onState: (s: SnakeSnapshot) => void }`.
  - Devuelve un `SnakeHandle` con `start()`, `pause()`, `resume()`, `restart()`, `end()`, `destroy()`, misma forma que los tres motores anteriores.
  - **Movimiento por tick de grid, no por posición continua.** El bucle sigue siendo `requestAnimationFrame` con `dt` en segundos (clamp `0.05`, igual que los demás motores), pero el movimiento de la serpiente avanza una celda completa cada vez que un acumulador de tiempo supera el intervalo vigente (`INITIAL_INTERVAL_MS` al inicio, decreciendo con `speedTier`). Para evitar que una pestaña en segundo plano provoque varios avances de golpe al volver (la serpiente "salta" varias celdas o se muerde a sí misma de forma injusta), el acumulador procesa **como máximo un tick de grid por frame**, descartando el resto del tiempo acumulado en exceso.
  - Dirección: se guarda una dirección "pendiente" que solo se aplica en el siguiente tick de grid (evita que dos pulsaciones rápidas dentro del mismo frame muevan la cabeza dos veces). Un giro de 180° respecto a la dirección actual (p.ej. ir a la derecha y pulsar izquierda) se ignora — no se admite invertir sobre el propio cuello.
  - Al comer una fruta: la serpiente crece un segmento, `score += FRUIT_POINTS` (mismo valor fijo para las 21 frutas, sin distinción de tipo), se cuenta como una fruta comida, y se sortea una nueva posición y un nuevo tipo de fruta aleatorio del `FRUIT_ATLAS` en una celda libre del grid. Cada `FRUITS_PER_SPEEDUP` (5) frutas comidas, `speedTier` sube en 1 y el intervalo de tick baja `SPEED_STEP_MS` (con piso `MIN_INTERVAL_MS`).
  - Colisión: la cabeza sale del grid (`x < 0 || x >= 20 || y < 0 || y >= 15`) o se solapa con cualquier segmento del cuerpo → fase pasa a `dying`. En `dying`, el movimiento se congela y la serpiente parpadea (alterna color normal / rojo) durante `BLINK_DURATION_MS`; al cumplirse ese tiempo, la fase pasa a `over` y se emite el snapshot final con `over: true`.
  - `start()` ata los listeners `keydown` (flechas) y arranca el `requestAnimationFrame`; se dispara automáticamente al montar el wrapper, sin pantalla de inicio propia, igual que los tres motores anteriores. `preventDefault` de las flechas solo actúa mientras la fase es `playing` o `dying`, nunca en `over` ni en pausa.
  - `pause()` cancela el rAF; `resume()` pone el acumulador de tick y `lastTime` a un estado que no arrastra el tiempo acumulado durante la pausa (mismo criterio que asteroides/tetris/arkanoid: sin salto al reanudar).
  - `restart()` reinicia la partida en caliente (serpiente de 3 segmentos en el centro del grid, `score` a 0, `speedTier` a 1, nueva fruta) sin recrear el handle. `end()` fuerza la fase `over` con el estado actual.
  - Se dibuja el cuerpo de la serpiente como bloques vectoriales por celda (`CELL × CELL`, con un margen interior de 2px), con relleno verde y `shadowBlur`/`shadowColor` para el efecto de brillo neón; la cabeza se distingue con un tono más claro. La fruta activa se dibuja con `ctx.drawImage` recortando del atlas (`fruits.png`) según el tipo sorteado. No hay dibujo de HUD de texto en el canvas ni overlay de "GAME OVER": el snapshot alimenta `.player-hud` y el modal de React. Se conserva únicamente el parpadeo de la fase `dying`, información efímera ligada a la escena (mismo criterio que los temporizadores de power-up en asteroides o la explosión de ladrillo en arkanoid).
  - `onState(snapshot)` se invoca solo cuando cambia `score`, `length`, `speedTier` o el flag `over` — nunca por frame ni por cada tick de movimiento sin cambio de longitud/velocidad/score.
- `lib/games/types.ts` (creado en SPEC 07, no se toca): `SnakeSnapshot extends GameSnapshot`, reutilizando `HudStat`/`GameSnapshot`.
- `app/_components/games/snake-game.tsx` (`"use client"`): wrapper de React, calcado de `arkanoid-game.tsx`.
  - `<canvas className="game-canvas">` de 800×600 dentro de `.crt`/`.crt-screen`, reutilizando la misma clase (4/3) sin ninguna regla CSS nueva.
  - `.player-hud` con `.hud-stat`: Jugador, Puntuación, Longitud, Velocidad (`x${speedTier}`).
  - Botones `.btn` PAUSA/REANUDAR, FIN, SALIR (`router.push("/juego/serpentina")`), escucha propia de `KeyP`/`Escape` para alternar pausa — igual patrón que los tres motores anteriores.
  - Modal "FIN DEL JUEGO" igual que los motores anteriores: `insertScore({ gameId: game.id, name, score })` desde `lib/scores-client.ts` (nunca `lib/scores.ts`), toast de guardado o error inline reutilizando `.toast-saved`, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`.
- `app/juego/[id]/jugar/page.tsx`: se amplía el registro `ENGINES` existente (`{ asteroids, tetris, arkanoid }`) con `snake: SnakeGame`.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Wrap-around en los bordes (teletransportarse al lado opuesto): se eligió game over estricto al tocar cualquier borde, como en la mayoría de versiones modernas de Snake.
- WASD como esquema alternativo de control: solo flechas, mismo criterio "un solo esquema de teclado" que asteroides/tetris/arkanoid.
- Comida especial/bonus con temporizador o valor distinto: todas las frutas del atlas valen lo mismo; no hay ítems especiales.
- Obstáculos en el grid, múltiples frutas simultáneas, o niveles/mapas distintos.
- Sonido.
- Skins o temas visuales alternativos para el cuerpo de la serpiente.
- Controles táctiles o de móvil.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica; el grid es fijo 20×15 celdas de 40px sobre un mundo 800×600.
- Pausa automática al perder el foco o cambiar de pestaña.
- Sin auth real, sin contador de `plays`, sin rate limiting en el `insert` de puntuaciones, sin realtime — mismas exclusiones de SPEC 05/06/07/08.
- Tests automatizados (no hay runner configurado), i18n, rediseño visual y `/frontend-design`.

---

## 3 — Modelo de datos

### Campo `engine` ampliado en `lib/games.ts`

```ts
export interface Game {
  // ...campos existentes...
  engine?: "asteroids" | "tetris" | "arkanoid" | "snake";
}
```

`serpentina` recibe `engine: "snake"` vía `update`, no vía `insert`. Su columna `long` también se actualiza vía `update` para mencionar frutas.

### Snapshot y handle del motor (`lib/games/snake/engine.ts`)

```ts
export interface SnakeSnapshot extends GameSnapshot {
  length: number; // segmentos de la serpiente, incluida la cabeza
  speedTier: number; // 1, 2, 3... sube cada FRUITS_PER_SPEEDUP frutas comidas
}

export interface SnakeHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: SnakeSnapshot) => void }
): SnakeHandle;
```

Reutiliza `GameSnapshot`/`HudStat` de `lib/games/types.ts` (creado en SPEC 07, no se toca). `stats` se construye dentro del motor en cada `onState`: `[{ l: "Puntuación", v: String(score) }, { l: "Longitud", v: String(length) }, { l: "Velocidad", v: \`x${speedTier}\` }]`.

### Atlas de frutas (tipado a partir de `sprites.js`)

```ts
// lib/games/snake/engine.ts
interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRUIT_ATLAS: Record<string, FruitSprite> = {
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  banana: { x: 34, y: 136, w: 110, h: 160 },
  // ...las 21 entradas de sprites.js, portadas tal cual, sin cambiar coordenadas...
};
```

Convenciones:

- Coordenadas del grid: origen arriba-izquierda, celdas cuadradas de `CELL = 40` px sobre un mundo fijo `800×600` (20×15 celdas), igual criterio de resolución fija que los tres motores anteriores.
- El movimiento de la serpiente avanza por ticks de grid acumulados a partir de `dt` en segundos (clamp `0.05`), con **máximo un tick procesado por frame** para evitar saltos al volver de una pestaña en segundo plano.
- El motor no importa nada de `next/*` ni de React: recibe un `HTMLCanvasElement`.
- El wrapper es la única isla `"use client"` nueva de este juego; la página `jugar` sigue siendo Server Component.
- El spritesheet de frutas se referencia con ruta absoluta `/games/snake/fruits.png` (movido de `references/source-assets/snake-assets/` a `public/games/snake/`).

---

## 4 — Plan de implementación

1. **Referencia, assets y campo de datos.** Mover `fruits.png` a `public/games/snake/fruits.png`. En `lib/games.ts`: ampliar `engine?: "asteroids" | "tetris" | "arkanoid" | "snake"` y actualizar los dos casts en `getGames()`/`getGameById()`. Migración: `update public.games set engine = 'snake' where id = 'serpentina';` y `update public.games set long = '<texto nuevo con frutas>' where id = 'serpentina';`. Verificación: `npx tsc --noEmit` compila; `select engine, long from games where id='serpentina'` refleja los cambios; `/juego/serpentina/jugar` sigue mostrando el reproductor falso (aún no hay entrada en el registro `ENGINES`); el asset responde en `/games/snake/fruits.png` sirviendo `npm run dev`.
2. **Motor — grid, atlas y bucle base.** Crear `lib/games/snake/engine.ts` con las constantes (`GAME_W`, `GAME_H`, `CELL`, `INITIAL_INTERVAL_MS`, `SPEED_STEP_MS`, `MIN_INTERVAL_MS`, `FRUITS_PER_SPEEDUP`, `BLINK_DURATION_MS`, `FRUIT_ATLAS` tipado desde `sprites.js`) y `createSnakeGame(canvas, opts)` con el estado de partida encapsulado (segmentos, dirección, fruta activa, acumulador de tick, `score`, `length`, `speedTier`, fase). Implementar `start()`/`destroy()` (arranca/cancela el `requestAnimationFrame`, sin listeners de teclado todavía) y `draw()` (grid de fondo opcional, cuerpo con bloques de brillo neón, fruta recortada del atlas). Verificación: `npx tsc --noEmit` compila; montado en una página de prueba, se ve la serpiente inicial de 3 segmentos y una fruta en el grid, sin movimiento aún.
3. **Movimiento, input y colisiones.** Añadir el acumulador de tick (avance de grid con clamp a un tick por frame), listeners `keydown` para las 4 flechas (con dirección pendiente y bloqueo de giro de 180°), atados en `start()` y quitados en `destroy()`, con `preventDefault` solo en fase `playing`/`dying`. Implementar el crecimiento al comer fruta (sorteo de nueva fruta y posición, `score += FRUIT_POINTS`, incremento de `speedTier` cada `FRUITS_PER_SPEEDUP`), la detección de colisión con bordes/cuerpo (pasa a fase `dying`), el parpadeo de `BLINK_DURATION_MS` y la transición a `over`. Métodos `pause()`/`resume()` (sin salto de acumulador), `restart()` (reinicio en caliente) y `end()` (fuerza `over`). `onState` emite `SnakeSnapshot` solo al cambiar `score`/`length`/`speedTier`/`over`. Verificación: `npx tsc --noEmit`; jugar manualmente en la página de prueba: la serpiente se mueve con las flechas, crece al comer, sube de velocidad cada 5 frutas, y choca contra el borde o su propia cola terminando la partida tras el parpadeo.
4. **Regla CSS del canvas.** No hace falta ninguna — se reutiliza `.game-canvas` de `app/globals.css` (mismo 800×600, 4/3, tal como los tres motores anteriores). Verificación: `npm run build` en verde, sin cambios en `app/globals.css`.
5. **Wrapper — canvas y HUD.** Crear `app/_components/games/snake-game.tsx` (`"use client"`): estructura `.crt`/`.crt-screen` con el `<canvas className="game-canvas">`. `useEffect` que crea el handle, llama `start()` y hace `destroy()` en el cleanup. `.player-hud` con Jugador (`useSession()`), Puntuación, Longitud y Velocidad del snapshot. Botones PAUSA/REANUDAR, FIN, SALIR (`router.push("/juego/serpentina")`) y escucha de `KeyP`/`Escape`. Verificación: `npx tsc --noEmit`; el componente importa sin romper el render de servidor.
6. **Wrapper — modal de fin y guardado.** Mismo patrón que los tres motores anteriores: modal "FIN DEL JUEGO" con `insertScore({ gameId: game.id, name, score })` de `lib/scores-client.ts`, error inline si falla, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`. Verificación: chocar contra un borde o pulsar FIN abre el modal tras el parpadeo; GUARDAR crea una fila nueva en `scores` (comprobable con `execute_sql`).
7. **Registro `engine → componente`.** Modificar `app/juego/[id]/jugar/page.tsx`: añadir `snake: SnakeGame` al objeto `ENGINES` ya existente (`{ asteroids, tetris, arkanoid }`). Verificación: `/juego/serpentina/jugar` muestra el canvas jugable de Snake; `/juego/rocas/jugar`, `/juego/caida/jugar` y `/juego/bloque-buster/jugar` siguen funcionando sin cambios.
8. **Cierre.** Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde. Repaso manual en `/juego/serpentina/jugar`: jugar una partida, comer varias frutas viendo que la serpiente crece y sube de velocidad cada 5, chocar contra un borde o contra su propia cola, ver el parpadeo y el modal, guardar la puntuación y comprobar que aparece en `/salon` (pestaña SERPENTINA) tras recargar.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `lib/games/snake/engine.ts` no importa nada de `react` ni de `next/*`.
- [ ] La ficha `serpentina` tiene `engine = 'snake'` en `public.games`; `rocas`, `caida` y `bloque-buster` siguen con sus motores respectivos sin cambios.
- [ ] El texto `long` de `serpentina` menciona frutas (no "núcleos magenta"); `title`, `short`, `cat`, `cover`, `color` no cambiaron.
- [ ] `/juego/serpentina/jugar` renderiza un `<canvas>` jugable dentro del marco `.crt`; las flechas mueven la serpiente por el grid de 20×15 celdas.
- [ ] Pulsar la dirección opuesta a la actual (giro de 180°) no invierte la serpiente sobre su propio cuello.
- [ ] Al comer una fruta, la serpiente crece un segmento, la puntuación de la barra HUD sube y aparece una nueva fruta (de tipo aleatorio entre las 21 del atlas) en una celda libre del grid.
- [ ] Cada 5 frutas comidas, el stat "Velocidad" de la barra HUD sube (`x1` → `x2` → ...) y la serpiente se mueve visiblemente más rápido.
- [ ] Tocar cualquier borde del canvas, o la propia cola de la serpiente, hace que la serpiente parpadee brevemente y luego termina la partida (aparece el modal "FIN DEL JUEGO").
- [ ] La serpiente no puede salir del grid ni hay wrap-around: siempre es game over al cruzar un borde.
- [ ] La barra `.player-hud` muestra Jugador, Puntuación, Longitud y Velocidad, actualizados desde el snapshot del motor (no con un `setInterval`).
- [ ] El botón PAUSA (o las teclas `P`/`Escape`) congela el juego; REANUDAR (o la misma tecla) lo continúa sin que la serpiente salte varias celdas de golpe.
- [ ] Mientras el juego está en pausa o en fin de partida, pulsar las flechas no bloquea el scroll de la página.
- [ ] En el modal, GUARDAR PUNTUACIÓN inserta una fila en `scores` (`{ game_id: "serpentina", name, score }`) vía `insertScore` de `lib/scores-client.ts` y muestra el toast de guardado.
- [ ] Si el `insert` de la puntuación falla, se muestra un error inline en el modal sin perder la partida ni navegar fuera.
- [ ] Guardar una puntuación desde el modal la hace aparecer en `/salon` (pestaña SERPENTINA) tras recargar la página.
- [ ] En el modal, JUGAR DE NUEVO reinicia la partida (serpiente de 3 segmentos, puntuación a 0, velocidad `x1`) sin recargar la ruta; VOLVER AL VAULT navega a `/biblioteca`.
- [ ] El botón SALIR navega a `/juego/serpentina`.
- [ ] Al navegar fuera de `/juego/serpentina/jugar`, el bucle `requestAnimationFrame` y el listener de teclado se han retirado (no hay doble bucle al volver a entrar, comprobable en el rendimiento y en la consola).
- [ ] `app/juego/[id]/jugar/page.tsx` usa el registro `ENGINES` ampliado con `snake: SnakeGame`; los otros tres juegos reales siguen funcionando sin cambios de comportamiento.
- [ ] Los juegos sin `engine` (por ejemplo `gloton`) siguen mostrando `<GamePlayer>` sin cambios.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** reusar la ficha `serpentina` ya existente en Supabase (título, categoría, portada y color sin cambios), añadiendo `engine: 'snake'` vía `update`. Su texto ya describe este juego; crear una ficha nueva habría duplicado un hueco que ya existía desde SPEC 06.
- **Sí:** reescribir solo el texto `long` de `serpentina` para mencionar frutas reales, ya que el motor usa el atlas de `fruits.png` en vez de los "núcleos magenta" abstractos del texto original.
- **No:** insertar una ficha nueva para este juego. Innecesario cuando `serpentina` ya está reservada para esto.
- **Sí:** el id del motor es `"snake"` (`engine: "snake"`, `createSnakeGame`, `lib/games/snake/engine.ts`), aunque la ficha visible se llame "SERPENTINA". Coherente con que los motores anteriores usan nombres de género/mecánica (`asteroids`, `tetris`, `arkanoid`), no el nombre de marketing de la ficha.
- **Sí:** frutas aleatorias del atlas en cada spawn, todas con el mismo valor de puntos. Aprovecha las 21 variantes visuales de `fruits.png` sin inventar una jerarquía de valores que el material de origen no sugiere.
- **No:** frutas con distinto valor de puntos según tipo. Se descartó por simplicidad, mismo criterio que arkanoid descartó puntuación por color de ladrillo.
- **Sí:** cuerpo de la serpiente dibujado con bloques vectoriales con brillo neón verde (`shadowBlur`/`shadowColor`), sin sprite externo. No hay sprite de serpiente en el material de origen, y el estilo "de luz" combina con el texto ya existente de la ficha ("una serpiente de luz recorre la grilla").
- **Sí:** HUD con Puntuación, Longitud y Velocidad (3 `.hud-stat`, además de Jugador). Son los tres datos reales que el juego produce sin inventar una mecánica de vidas o nivel que Snake no tiene de forma nativa.
- **No:** HUD con "vidas" o "nivel" genéricos calcados de asteroides. Snake no tiene esa forma — forzarlo habría significado inventar datos, lo que el snapshot flexible de SPEC 07 existe justamente para evitar.
- **Sí:** la velocidad aumenta cada `FRUITS_PER_SPEEDUP` (5) frutas comidas, con un piso mínimo de intervalo (`MIN_INTERVAL_MS`). Es la mecánica de dificultad progresiva estándar de Snake y coincide con el texto ya existente de la ficha ("cada bocado la alarga y la hace más veloz").
- **No:** velocidad constante durante toda la partida. Habría hecho el juego más plano y no habría aprovechado el texto ya escrito de la ficha.
- **Sí:** game over estricto al tocar cualquier borde del grid (sin wrap-around). Es el comportamiento más común en versiones modernas de Snake y es más simple de razonar junto al parpadeo de fin de partida.
- **No:** wrap-around en los bordes (teletransporte al lado opuesto, estilo Nokia). Queda como posible variante de una spec futura si se pide explícitamente.
- **Sí:** solo flechas como control, sin WASD adicional. Mismo criterio "un solo esquema de teclado" que asteroides/tetris/arkanoid ya establecieron.
- **No:** flechas + WASD simultáneos. Habría sido la única divergencia del patrón solo-flechas del resto de motores.
- **Sí:** bloquear el giro de 180° sobre la dirección actual. Comportamiento estándar de Snake — invertirse de golpe sobre el propio cuello se consideraría un bug, no una mecánica, en la mayoría de implementaciones de referencia.
- **No:** permitir el giro de 180° (y que choque contra el segundo segmento). Se descartó por ser menos intuitivo para quien conoce Snake.
- **Sí:** parpadeo breve (`BLINK_DURATION_MS = 400`) de la serpiente antes de marcar `over: true` y abrir el modal. Da una señal visual clara del choque, mismo criterio de "información efímera ligada a la escena" que los temporizadores de power-up en asteroides o la explosión de ladrillo en arkanoid.
- **No:** transición directa a `over` sin ningún efecto visual. Se prefirió una señal breve de feedback sobre la inmediatez total.
- **Sí:** movimiento por ticks de grid acumulados a partir de `dt` en segundos, con máximo un tick procesado por frame. Es la única forma de tener un Snake "por celdas" que además sea independiente del framerate del monitor y no salte varias celdas de golpe al volver de una pestaña en segundo plano.
- **No:** mover la serpiente con posición continua (píxel a píxel) como asteroides/arkanoid. Rompería la naturaleza de grid de Snake — el juego se juega por celdas, no por física continua.
- **Sí:** grid fijo de 20×15 celdas de 40px sobre un mundo 800×600, reutilizando `.game-canvas` (4/3) sin ninguna regla CSS nueva. Evita repetir la decisión de aspect ratio que sí hizo falta en SPEC 07 (Tetris), ya que 800×600 con celdas cuadradas de 40px encaja exacto en 4/3.
- **No:** grid más fino (celdas de 20px, 40×30). Se descartó por simplicidad; el grid 20×15 ya da suficiente espacio de juego para una serpiente que crece.
- **Sí:** mover `fruits.png` a `public/games/snake/` con ruta absoluta, y tipar las coordenadas de `sprites.js` como una constante TypeScript dentro del motor en vez de copiar el archivo JS tal cual. Sigue la trampa documentada en `contrato-plataforma.md` (f.7 y f.8) para assets y datos implícitos.
- **Sí:** `insertScore` desde `lib/scores-client.ts`, nunca desde `lib/scores.ts`, siguiendo la trampa ya documentada en el contrato sección (e).
- **No:** comida especial/bonus, obstáculos, sonido, skins o control táctil. Snake clásico estándar, sin mecánicas extra no descritas en el texto original de la ficha.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                             | Mitigación                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El acumulador de tick procesa más de un avance de grid por frame tras una pestaña en segundo plano, y la serpiente "salta" varias celdas o se muerde injustamente. | El acumulador procesa como máximo un tick de grid por frame y descarta el exceso, además del clamp de `dt` a `0.05` ya estándar en los otros motores. Criterio de aceptación dedicado en pausa/reanudar.                |
| El bucle `requestAnimationFrame` o el listener de teclado no se limpian al navegar y queda un bucle fantasma.                                                      | `handle.destroy()` se llama en el cleanup del `useEffect`; cancela el `requestAnimationFrame` y quita el listener `keydown`. Criterio de aceptación dedicado.                                                           |
| `preventDefault` de las flechas bloquea el scroll del resto de la página.                                                                                          | Solo se aplica en fase `playing`/`dying`, nunca en pausa ni `over`; listener retirado al desmontar.                                                                                                                     |
| Coordenadas del atlas de frutas mal transcritas de `sprites.js` producen recortes visualmente incorrectos o transparentes.                                         | Las 21 entradas se portan literalmente sin recalcular; se verifica visualmente en el paso 2 del plan que la fruta activa se ve completa y sin recorte extraño antes de continuar con el resto del motor.                |
| `onState` invocado en cada tick de grid (no solo al cambiar longitud/score/velocidad) satura React de renders.                                                     | Se emite solo cuando cambian `score`/`length`/`speedTier`/`over`, igual que los tres motores anteriores — un tick sin crecimiento no dispara `onState`.                                                                 |
| El parpadeo de la fase `dying` deja la serpiente "congelada" indefinidamente si un bug impide la transición a `over`.                                              | `BLINK_DURATION_MS` es un temporizador simple basado en tiempo acumulado desde la colisión, verificado manualmente en el paso 3 del plan antes de conectar el modal.                                                    |
| Next 16 trata `params` como `Promise` y `PageProps` es un global generado.                                                                                         | `app/juego/[id]/jugar/page.tsx` ya usa `await params` y `PageProps<"/juego/[id]/jugar">`; esta spec solo añade una entrada al registro `ENGINES` ya existente. Revisar `node_modules/next/dist/docs/` antes de tocarla. |

---

## Lo que **no** entra en esta spec

- Wrap-around en los bordes del grid.
- WASD como esquema alternativo de control.
- Comida especial/bonus con valor distinto o temporizador.
- Obstáculos en el grid, múltiples frutas simultáneas, o niveles/mapas distintos.
- Sonido.
- Skins o temas visuales alternativos para el cuerpo de la serpiente.
- Controles táctiles o de móvil.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica.
- Pausa automática al perder el foco.
- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- `/frontend-design`, rediseño del marco del reproductor, tests automatizados e i18n.

Cada uno de esos puntos, si llega, va en su propia spec.
