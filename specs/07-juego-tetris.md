# SPEC 07 — Juego de Tetris real para la ficha `caida`

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-11
> **Objetivo:** Adaptar el juego de `references/started-games/03-tetris/` a la plataforma como motor real jugable de la ficha `caida`, sustituyendo la cadena de `if` de `app/juego/[id]/jugar/page.tsx` por un registro `engine → componente` que ya contempla `asteroids` y el nuevo `tetris`.

---

## 1 — Por qué existe esta spec

SPEC 05 y SPEC 06 dejaron un solo juego real (`rocas`, motor `asteroids`) y siete fichas con el reproductor falso `<GamePlayer>`. Entre ellas está `caida` (PUZZLE, `cover-tetro`, magenta), cuyo texto ("Piezas geométricas descienden... rótalas, encástralas y limpia líneas... la velocidad aumenta cada 10 líneas") ya describe un Tetris — es la ficha reservada para este motor.

`references/started-games/03-tetris/` es un Tetris completo: canvas 2D de 300×600 (grid 10×20, bloques de 30px), bucle propio con `requestAnimationFrame`, siete tetrominós estándar más dos piezas propias de esta referencia (Tuerca: anillo 3×3 con hueco; Bomba: destruye un área 3×3 al bloquear), pieza fantasma, canvas secundario de vista previa de la siguiente pieza, cuatro skins visuales seleccionables y un HUD en DOM (`<span>`) en vez de en canvas. Es un script global con estado a nivel de módulo, overlays HTML propios de inicio/pausa/game-over y su propio leaderboard en `localStorage`.

Esta spec porta ese juego a la arquitectura del proyecto, lo enchufa a la ficha `caida` existente (solo se le añade `engine: "tetris"`, sin tocar su título ni sus textos) y resuelve la decisión que SPEC 05 dejó pendiente a propósito: sustituir la rama `if (game.engine === "asteroids")` de `app/juego/[id]/jugar/page.tsx` por el registro `engine → componente` descrito en `contrato-plataforma.md` sección (d). Como en SPEC 05, no se usa `/frontend-design` para el marco general (se reutilizan `.crt`, `.player-hud`, `.btn`, `.modal`); si hiciera falta una `.cover-*` nueva sí pasaría por ahí, pero no es el caso porque `cover-tetro` ya existe.

---

## 2 — Alcance

**Dentro:**

- `references/started-games/03-tetris/` (hoy sin trackear) se añade al repositorio como material de referencia.
- `lib/games.ts`: el union `engine?: "asteroids"` pasa a `engine?: "asteroids" | "tetris"`, actualizando los dos casts literales `(g.engine as "asteroids" | null) ?? undefined` (en `getGames()` y `getGameById()`) a `(g.engine as "asteroids" | "tetris" | null) ?? undefined`.
- Migración Supabase (`apply_migration`): `update public.games set engine = 'tetris' where id = 'caida';`. No es un `insert` — la fila `caida` ya existe desde el seed de SPEC 06 con título, textos, categoría, portada y color ya correctos; solo se activa su motor. `best`, `plays`, `title`, `short`, `long`, `cat`, `cover`, `color` no se tocan.
- `lib/games/types.ts` (nuevo): `HudStat` y `GameSnapshot`, el snapshot flexible compartido de `contrato-plataforma.md` sección (c). Primera vez que se necesita — `lib/games/asteroids/engine.ts` no se toca ni se migra a este tipo.
- `lib/games/tetris/engine.ts`: el juego portado a TypeScript.
  - Constantes puras a nivel de módulo: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES` (los 7 tetrominós + Tuerca + Bomba), `LINE_SCORES`, `BOMB`, `BOMB_RADIUS`, `BOMB_BLOCK_SCORE`, `SKINS` (paletas y estilos de dibujo de los 4 skins, sin `bg`/`grid` dependientes de tema porque el tema claro/oscuro no se porta).
  - Todo el estado de partida (`board`, `current`, `next`, `score`, `lines`, `level`, `combo`, `maxCombo`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`) vive dentro de una fábrica `createTetrisGame(canvas, opts)`.
  - `opts`: `{ onState: (s: TetrisSnapshot) => void; skin: TetrisSkin; nextCanvas?: HTMLCanvasElement }`. El skin se fija al crear el motor — no hay `setSkin()` en el handle; para cambiar de skin el wrapper destruye y vuelve a crear el motor.
  - Devuelve un `TetrisHandle` con `start()`, `pause()`, `resume()`, `restart()`, `end()`, `destroy()`, misma forma que `AsteroidsHandle`.
  - `start()` ata los listeners `keydown` (flechas, `KeyX`, `Space`, `KeyP`/`Escape`) y arranca el `requestAnimationFrame`; se dispara automáticamente al montar el wrapper — no hay pantalla de inicio propia del motor, igual que asteroides.
  - `dt` se calcula en segundos (`(ts - lastTime) / 1000`, clamp `0.05` como asteroides) y se acumula contra `dropInterval` (que sigue en milisegundos, igual que el original, para no reescribir la tabla de velocidades por nivel).
  - `preventDefault` de flechas/`Space` solo mientras la partida está activa (no en pausa ni game over).
  - Se elimina el dibujo de HUD en DOM (`updateHUD()` y los `<span>` del original no existen: el motor no toca el DOM fuera de sus canvas) — el snapshot alimenta la barra `.player-hud` de React.
  - Se elimina el reinicio por botón interno (`restart-btn`/`play-btn`/`pause-restart-btn` y sus overlays HTML `#start-overlay`, `#overlay`, `#pause-menu`): el único camino de reinicio es `handle.restart()` desde el modal de la plataforma.
  - Se elimina el leaderboard propio (`localStorage['tetris-records']`, `bestCombo`/`maxLines` agregados, `qualifiesForTop`, `addScore`, `renderRecords`) — lo reemplaza el leaderboard de Supabase vía `insertScore`/`getTopScores` (SPEC 06).
  - Se elimina el toggle de tema claro/oscuro y su `localStorage['theme']`.
  - Se conservan: los 7 tetrominós + Tuerca + Bomba con sus mismos valores de forma/color/puntuación; la pieza fantasma; el combo (se sigue calculando internamente para el bonus de puntuación aunque no aparezca en el HUD); el canvas secundario de vista previa de la siguiente pieza, dibujado por el motor sobre `opts.nextCanvas` si se pasa.
  - `onState(snapshot)` se invoca solo cuando cambia algo relevante (`score`, `lines`, `level`, `combo`, `over`), nunca por frame.
- `app/_components/games/tetris-game.tsx` (`"use client"`): wrapper de React, calcado de `asteroids-game.tsx` con las diferencias de la sección (e) del contrato.
  - Dos `<canvas>`: el principal (`className="game-canvas-tetris"`, 300×600) y el de "siguiente pieza" (120×120), ambos dentro de `.crt-screen`.
  - `<select>` de skin nuevo dentro de `.player-hud`, con las 4 opciones (`retro`, `neon`, `pastel`, `pixel`). Su valor inicial se lee de `localStorage['av_tetris_skin']` (o `'retro'` si no hay nada guardado); cada cambio escribe la clave y recrea el motor (nuevo `useEffect` con `skin` en las dependencias, que hace `destroy()` del handle anterior y `start()` de uno nuevo).
  - `.player-hud` con `.hud-stat`: Jugador, Puntuación, Líneas, Nivel (Combo no aparece en el HUD, según lo decidido en la sección 6).
  - Botones `.btn` PAUSA/REANUDAR, FIN, SALIR (`router.push("/juego/caida")`), igual que asteroides.
  - Escucha propia de `KeyP`/`Escape` para alternar pausa, atada en el mismo `useEffect` que crea el motor.
  - Modal "FIN DEL JUEGO" igual que asteroides: `insertScore({ gameId: game.id, name, score })` desde `lib/scores-client.ts` (nunca `lib/scores.ts`), toast de guardado o error inline reutilizando `.toast-saved`, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`.
- `app/juego/[id]/jugar/page.tsx`: se sustituye la rama `if (game.engine === "asteroids")` por el registro `ENGINES = { asteroids: AsteroidsGame, tetris: TetrisGame }` de `contrato-plataforma.md` sección (d).
- `app/globals.css`: el marco reutiliza `.crt-screen` (mismo `aspect-ratio: 4 / 3` que asteroides, sin variante propia); nueva regla `.game-canvas-tetris` que mantiene la proporción real del tablero (`1 / 2`) dentro de ese marco vía `height: 100%`, `width: auto`, centrada (sin distorsionar los bloques ni estirarlos a 4:3), más una regla mínima para el segundo `<canvas>` de vista previa (tamaño fijo pequeño, mismo borde/fondo que el resto del panel). No se toca `.game-canvas` ni su uso en asteroides.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Los 4 skins visuales (retro/neon/pastel/pixel) se portan como prop del wrapper, fija al crear el motor — no hay cambio de skin en caliente sin recrear el motor, ni un `setSkin()` en el `TetrisHandle`.
- El toggle de tema claro/oscuro del original y su `localStorage['theme']`.
- El leaderboard propio del original (`localStorage['tetris-records']`, top 5, `bestCombo`, `maxLines` agregados) — reemplazado enteramente por Supabase.
- El selector de "nivel inicial" (hasta 15) del menú de pausa original. Toda partida empieza en nivel 1.
- La pantalla de inicio propia (`#start-overlay` con botón "Jugar") y el menú de pausa propio (`#pause-menu` con controles/nivel inicial) — el motor arranca automático al montar, como asteroides.
- Controles táctiles o de móvil.
- Sonido.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica.
- Pausa automática al perder el foco o cambiar de pestaña.
- Guardar la preferencia de skin en Supabase o vincularla a una cuenta: sigue siendo `localStorage` local al navegador.
- Reescribir el texto `short`/`long` de la ficha `caida`: ya describe correctamente este motor, no hace falta tocarlo.
- Sin auth real, sin contador de `plays`, sin rate limiting en el `insert` de puntuaciones, sin realtime — mismas exclusiones de SPEC 05/06.
- Tests automatizados (no hay runner configurado), i18n, rediseño visual y `/frontend-design`.

---

## 3 — Modelo de datos

### Campo `engine` ampliado en `lib/games.ts`

```ts
export interface Game {
  // ...campos existentes...
  engine?: "asteroids" | "tetris";
}
```

`caida` recibe `engine: "tetris"` vía `update`, no vía `insert`.

### Snapshot flexible nuevo (`lib/games/types.ts`)

```ts
export interface HudStat {
  l: string; // "Líneas", "Nivel"
  v: string; // valor ya formateado: "042", "3"
}

export interface GameSnapshot {
  score: number;
  over: boolean;
  stats: HudStat[]; // hasta 3 entradas
}
```

### Snapshot y handle del motor (`lib/games/tetris/engine.ts`)

```ts
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";

export interface TetrisSnapshot extends GameSnapshot {
  lines: number;
  level: number;
  combo: number; // se calcula igual que el original; no forma parte de `stats`
}

export interface TetrisHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  opts: {
    onState: (s: TetrisSnapshot) => void;
    skin: TetrisSkin;
    nextCanvas?: HTMLCanvasElement;
  }
): TetrisHandle;
```

`stats` se construye dentro del motor a partir de `lines`/`level` en cada `onState`: `[{ l: "Líneas", v: String(lines) }, { l: "Nivel", v: String(level) }]`.

Convenciones:

- Coordenadas del tablero: grid `10 × 20`, bloque de `30px`, canvas principal `300×600` como sistema de coordenadas fijo; el tamaño visible lo da CSS (`.game-canvas-tetris`).
- El canvas de vista previa mantiene `120×120` fijo, sin escalar por CSS.
- Velocidades/tiempos en milisegundos para `dropInterval` (igual que el original); `dt` del bucle se calcula y clampa en segundos como en asteroides, y se convierte a milisegundos solo al compararlo contra `dropInterval`.
- El motor no importa nada de `next/*` ni de React: recibe uno o dos `HTMLCanvasElement` y un `skin` de solo lectura.
- El wrapper es la única isla `"use client"` nueva de este juego; la página `jugar` sigue siendo Server Component.
- `localStorage['av_tetris_skin']` es la única clave de `localStorage` propia de este motor — vive en el wrapper de React, no dentro de `lib/games/tetris/engine.ts`.

---

## 4 — Plan de implementación

1. **Referencia y campo de datos.** Añadir `references/started-games/03-tetris/` al repositorio. En `lib/games.ts`: ampliar `engine?: "asteroids" | "tetris"` y actualizar los dos casts en `getGames()`/`getGameById()`. Migración `update public.games set engine = 'tetris' where id = 'caida';`. Verificación: `npx tsc --noEmit` compila; `select engine from games where id='caida'` devuelve `'tetris'`; `/juego/caida/jugar` sigue mostrando el reproductor falso (aún no hay rama para `tetris` en la página).
2. **Snapshot flexible compartido.** Crear `lib/games/types.ts` con `HudStat` y `GameSnapshot`. Verificación: `npx tsc --noEmit` compila; `lib/games/asteroids/engine.ts` no se modifica ni importa este archivo.
3. **Motor portado — piezas, tablero y bucle.** Crear `lib/games/tetris/engine.ts` con las constantes (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES` con las 9 piezas, `LINE_SCORES`, `BOMB*`, `SKINS`), las utilidades (`createBoard`, `randomPiece`, `collide`, `rotateCW`, `merge`, `clearLines`, `bombCells`, `explode`, `ghostY`) portadas sin cambiar valores, y `createTetrisGame(canvas, opts)` con el estado de partida encapsulado. Implementar `start()`/`destroy()` (arranca/cancela el `requestAnimationFrame`, sin listeners todavía) y el `draw()` (tablero, pieza fantasma, pieza actual, sin HUD de texto). Verificación: `npx tsc --noEmit` compila; montado en una página de prueba, el tablero se dibuja y una pieza cae sola con el skin `retro`.
4. **Input, piezas especiales y control de partida.** Añadir listeners `keydown` (flechas, `KeyX`, `Space`, `KeyP`/`Escape`), atados en `start()` y quitados en `destroy()`, con `preventDefault` solo en partida activa. Implementar `hardDrop`, `softDrop`, `tryRotate`, `lockPiece` (incluyendo `bombCells`/`explode` para la pieza Bomba), `pause()`, `resume()` (sin salto de `dt`), `restart()`, `end()`. `onState` emite `TetrisSnapshot` (con `stats` ya construido) solo al cambiar `score`/`lines`/`level`/`combo`/`over`. Verificación: `npx tsc --noEmit`; jugar manualmente en la página de prueba: mover, rotar, caída dura/suave, limpiar una línea, activar una Bomba y ver que destruye un área 3×3.
5. **Canvas de vista previa y skins.** Añadir el dibujo de la siguiente pieza sobre `opts.nextCanvas` (si se pasa) reutilizando `drawBlock` con el skin activo; portar las 4 paletas (`SKINS`) sin `bg`/`grid` dependientes de tema. Verificación: `npx tsc --noEmit`; cambiar el `skin` pasado a `createTetrisGame` (recreando el motor en la página de prueba) cambia el estilo de los bloques y de la vista previa.
6. **Reglas CSS del canvas.** Añadir `.game-canvas-tetris` y la regla del canvas de vista previa a `app/globals.css`. Verificación: `npm run build` en verde; las reglas aún no se usan.
7. **Wrapper — canvas, HUD y selector de skin.** Crear `app/_components/games/tetris-game.tsx` (`"use client"`): estructura `.crt`/`.crt-screen` con los dos `<canvas>`, `.player-hud` con Jugador/Puntuación/Líneas/Nivel y el `<select>` de skin (leído/escrito en `localStorage['av_tetris_skin']`). `useEffect` con `skin` en dependencias que crea el handle, llama `start()` y hace `destroy()` en el cleanup al desmontar o al cambiar de skin. Botones PAUSA/REANUDAR, FIN, SALIR (`router.push("/juego/caida")`) y escucha de `KeyP`/`Escape`. Verificación: `npx tsc --noEmit`; el componente importa sin romper el render de servidor.
8. **Wrapper — modal de fin y guardado.** Igual patrón que `asteroids-game.tsx`: modal "FIN DEL JUEGO" con `insertScore({ gameId: game.id, name, score })` de `lib/scores-client.ts`, error inline si falla, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`. Verificación: pulsar FIN abre el modal; GUARDAR crea una fila nueva en `scores` (comprobable con `execute_sql`).
9. **Registro `engine → componente`.** Modificar `app/juego/[id]/jugar/page.tsx`: sustituir la rama `if (game.engine === "asteroids")` por `const ENGINES = { asteroids: AsteroidsGame, tetris: TetrisGame } as const;` y `const Engine = game.engine ? ENGINES[game.engine as keyof typeof ENGINES] : undefined;`. Verificación: `/juego/caida/jugar` muestra el canvas jugable de Tetris; `/juego/rocas/jugar` sigue mostrando asteroides sin cambios; `/juego/serpentina/jugar` (sin `engine`) sigue con `<GamePlayer>`.
10. **Cierre.** Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde. Repaso manual en `/juego/caida/jugar`: jugar una partida, limpiar líneas, activar Tuerca y Bomba, cambiar de skin, perder, guardar la puntuación y comprobar que aparece en `/salon` (pestaña CAÍDA) tras recargar.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `lib/games/tetris/engine.ts` no importa nada de `react` ni de `next/*`.
- [ ] La ficha `caida` tiene `engine = 'tetris'` en `public.games`; ninguna otra ficha lo lleva salvo `rocas` con `'asteroids'`.
- [ ] `/juego/caida/jugar` renderiza un `<canvas>` jugable dentro del marco `.crt`; `←`/`→` mueven, `↑`/`X` rotan, `↓` hace soft drop, `Space` hace hard drop.
- [ ] Al completar una línea se elimina del tablero, la puntuación y el contador de líneas de la barra HUD suben, y cada 10 líneas sube el nivel (visible en el HUD) y la caída se acelera.
- [ ] La pieza Tuerca (anillo 3×3 con hueco) y la pieza Bomba (destruye un área 3×3 al bloquear, sumando puntos por bloque destruido) se comportan igual que en la referencia.
- [ ] La pieza fantasma se dibuja en el canvas mostrando dónde caerá la pieza actual.
- [ ] El canvas de vista previa muestra la siguiente pieza con el skin activo.
- [ ] La barra `.player-hud` muestra Jugador, Puntuación, Líneas y Nivel, actualizados desde el snapshot del motor (no con un `setInterval`).
- [ ] El `<select>` de skin cambia el estilo visual de los bloques (tablero, pieza actual, fantasma y vista previa) entre `retro`/`neon`/`pastel`/`pixel`, y la elección persiste en `localStorage['av_tetris_skin']` entre recargas.
- [ ] El botón PAUSA (o las teclas `P`/`Escape`) congela el juego; REANUDAR (o la misma tecla) lo continúa sin salto de posición ni de piezas.
- [ ] Mientras el juego está en pausa o en fin de partida, pulsar las flechas o `Space` no bloquea el scroll de la página.
- [ ] Al llenar el tablero hasta que una pieza nueva no puede aparecer, o al pulsar FIN, aparece el `.modal` "FIN DEL JUEGO" con la puntuación final.
- [ ] En el modal, GUARDAR PUNTUACIÓN inserta una fila en `scores` (`{ game_id: "caida", name, score }`) vía `insertScore` de `lib/scores-client.ts` y muestra el toast de guardado.
- [ ] Si el `insert` de la puntuación falla, se muestra un error inline en el modal sin perder la partida ni navegar fuera.
- [ ] Guardar una puntuación desde el modal la hace aparecer en `/salon` (pestaña CAÍDA) tras recargar la página.
- [ ] En el modal, JUGAR DE NUEVO reinicia la partida (tablero vacío, puntuación a 0, nivel 1) sin recargar la ruta; VOLVER AL VAULT navega a `/biblioteca`.
- [ ] El botón SALIR navega a `/juego/caida`.
- [ ] Al navegar fuera de `/juego/caida/jugar`, el bucle `requestAnimationFrame` y los listeners de teclado se han retirado (no hay doble bucle al volver a entrar, comprobable en el rendimiento y en la consola).
- [ ] `app/juego/[id]/jugar/page.tsx` usa el registro `ENGINES = { asteroids: AsteroidsGame, tetris: TetrisGame }` en vez de una cadena de `if`; `/juego/rocas/jugar` sigue funcionando sin cambios de comportamiento.
- [ ] Los juegos sin `engine` (por ejemplo `serpentina`) siguen mostrando `<GamePlayer>` sin cambios.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** reusar la ficha `caida` ya existente en Supabase (título, textos, categoría, portada y color sin cambios), añadiendo solo `engine: 'tetris'` vía `update`. Su texto ya describe un Tetris; crear una ficha nueva habría duplicado un hueco que ya existía desde SPEC 06.
- **No:** insertar una ficha nueva para este juego. Innecesario cuando `caida` ya está reservada para esto.
- **Sí:** el id del motor es `"tetris"` (`engine: "tetris"`, `createTetrisGame`, `lib/games/tetris/engine.ts`), aunque la ficha visible se llame "CAÍDA". Evita ambigüedad técnica entre el nombre de la ficha y el nombre del motor; coherente con que `rocas` usa `engine: "asteroids"` y no `"rocas"`.
- **Sí:** resolver ahora el registro `engine → componente` de `contrato-plataforma.md` sección (d), sustituyendo la cadena de `if` de la página `jugar`. Esta es la spec del segundo motor real que SPEC 05 dejó pendiente para esta decisión.
- **Sí:** snapshot flexible (`GameSnapshot`/`HudStat` en `lib/games/types.ts`) en vez de forzar el snapshot `{score, lives, level, over}` de asteroides. Tetris no tiene vidas; forzarlo habría significado inventar un dato que el juego no tiene.
- **No:** migrar `lib/games/asteroids/engine.ts` al nuevo snapshot flexible. Su forma actual sigue funcionando tal cual; el contrato lo prohíbe explícitamente como efecto colateral de portar el siguiente juego.
- **Sí:** HUD con Puntuación, Líneas y Nivel (3 `.hud-stat`, el máximo del snapshot flexible). Son las tres métricas más representativas de una partida de Tetris.
- **No:** incluir Combo en el HUD visible. El snapshot lo sigue calculando (se usa igual que en el original para el bonus de puntuación), pero no hay hueco para una cuarta `.hud-stat` sin ampliar el contrato del snapshot más allá de 3 entradas.
- **Sí:** portar las piezas Tuerca y Bomba con sus mismos valores. Son parte de la identidad de esta referencia concreta y no dependen de nada que el contrato prohíba portar (no tocan DOM, `localStorage` ni HUD).
- **Sí:** conservar la pieza fantasma. Mecánica visual estándar de Tetris ligada a la escena del canvas, sin conflicto con ningún invariante.
- **Sí:** conservar los 4 skins visuales, pero como prop de React fija al crear el motor (`opts.skin`), no como estado interno con su propio `<select>` HTML dentro del juego. Sigue la indicación explícita del contrato sección (f.5) para variantes visuales que se quieren conservar.
- **No:** un método `setSkin()` en `TetrisHandle` para cambiar de skin sin recrear el motor. Amplía el contrato del handle más allá de `start/pause/resume/restart/end/destroy`; recrear el motor al cambiar el `<select>` es más simple y el costo (perder la partida en curso) es aceptable para un cambio estético.
- **Sí:** persistir la preferencia de skin en `localStorage['av_tetris_skin']`, gestionada por el wrapper de React, no por el motor. No compite con el leaderboard de Supabase (es una preferencia visual, no una puntuación), así que no repite el problema que sí tenía el leaderboard propio del original.
- **No:** eliminar la persistencia de skin y resetear siempre a `retro`. El usuario prefirió conservar la comodidad de no reelegir skin en cada partida.
- **Sí:** eliminar el toggle de tema claro/oscuro y su `localStorage['theme']`. La plataforma no tiene modo claro; mantenerlo habría sido una feature aislada sin equivalente en el resto de Arcade Vault.
- **Sí:** eliminar el selector de "nivel inicial" del menú de pausa original. Toda partida empieza en nivel 1, igual que asteroides no tiene dificultad inicial seleccionable.
- **Sí:** el motor arranca automáticamente al montar el wrapper (sin pantalla de inicio propia con botón "Jugar"). Coherente con el patrón ya establecido por `createAsteroidsGame`.
- **No:** conservar `#start-overlay`, `#overlay` y `#pause-menu` como overlays HTML propios del juego. Los sustituyen por completo el HUD y el modal de la plataforma, como en asteroides.
- **Sí:** eliminar por completo el leaderboard propio (`localStorage['tetris-records']`, top 5, `bestCombo`/`maxLines`). SPEC 06 ya resolvió el leaderboard real vía Supabase; mantener el propio habría sido una segunda fuente de verdad.
- **Sí:** segundo `<canvas>` de vista previa como elemento aparte del wrapper, con el motor dibujando en él directamente (`opts.nextCanvas`). Más fiel al original que convertir la forma de la siguiente pieza en datos crudos para que React la pinte con otra técnica.
- **No:** codificar la siguiente pieza como datos en el snapshot y pintarla con HTML/CSS o iconos. Habría significado reescribir el dibujo de piezas dos veces (canvas para el tablero, otra técnica para la vista previa) sin necesidad.
- **No (revertido tras repaso manual):** clase CSS específica `.game-canvas-tetris` con `aspect-ratio: 1 / 2` para el marco. En el repaso manual del cierre de la spec, el usuario reportó que el marco resultante (el doble de alto que ancho) era demasiado alto para la pantalla.
- **Sí (decisión final):** el marco (`.crt-screen`) de la ficha `caida` reutiliza el mismo `aspect-ratio: 4 / 3` que asteroides — ya no existe una variante `.crt-screen-tetris`. Dentro de ese marco, el `<canvas>` del tablero mantiene su proporción real `1 / 2` sin distorsión (`height: 100%`, `width: auto`, centrado horizontalmente con `.crt-screen` en `overflow: hidden`), dejando espacio vacío a los lados en vez de estirar los bloques o recortar el tablero.
- **Sí:** `dropInterval` sigue en milisegundos (igual que el original) mientras que `dt` del bucle se calcula y clampa en segundos como en asteroides, convirtiendo solo en la comparación. Evita reescribir la tabla de velocidades por nivel del original sin perder el invariante de timestep en segundos del contrato.
- **Sí:** `insertScore` desde `lib/scores-client.ts`, nunca desde `lib/scores.ts`, siguiendo la trampa ya documentada en el contrato sección (e).

---

## 7 — Riesgos identificados

| Riesgo                                                                                                              | Mitigación                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El bucle `requestAnimationFrame` o los listeners de teclado no se limpian al navegar y queda un bucle fantasma.     | `handle.destroy()` se llama en el cleanup del `useEffect`, incluido al cambiar de skin (que recrea el motor); cancela el `requestAnimationFrame` y quita `keydown`. Criterio de aceptación dedicado.                          |
| `preventDefault` de flechas/`Space` bloquea el scroll del resto de la página.                                       | Solo se aplica en partida activa, nunca en pausa ni game over; listeners retirados al desmontar.                                                                                                                              |
| Recrear el motor al cambiar de skin pierde el progreso de la partida en curso sin avisar al jugador.                | Documentado como decisión explícita (sección 6); el `<select>` de skin queda fuera del flujo de "partida en curso" en los criterios de aceptación, que no exigen preservar estado al cambiar de skin.                         |
| El segundo canvas de vista previa queda desincronizado si el motor no repinta tras cada `spawn()`.                  | El motor llama al dibujo de `nextCanvas` en el mismo punto donde el original llama `drawNext()` (justo después de `spawn()`), dentro del mismo módulo que ya tiene esa lógica portada.                                        |
| `onState` invocado cada frame satura React de renders y baja los FPS.                                               | Se emite solo cuando cambian `score`/`lines`/`level`/`combo`/`over`, igual que asteroides.                                                                                                                                    |
| `dropInterval` en milisegundos y `dt` del bucle en segundos se mezclan mal y la caída corre a velocidad incorrecta. | La conversión se hace en un único punto de comparación (`dropAccum` acumulado en ms, `dt` convertido de segundos a ms antes de sumarlo), documentado en el plan paso 3-4 antes de escribir el código.                         |
| Next 16 trata `params` como `Promise` y `PageProps` es un global generado.                                          | `app/juego/[id]/jugar/page.tsx` ya usa `await params` y `PageProps<"/juego/[id]/jugar">`; esta spec solo cambia la resolución interna de `game.engine` a componente. Revisar `node_modules/next/dist/docs/` antes de tocarla. |
| Assets/paletas de skin con nombres de color duplicados entre skins genera bugs sutiles al portar `SKINS`.           | Se portan las 4 paletas completas tal cual del original (mismo array `colors` por índice de pieza), sin renombrar ni reordenar.                                                                                               |

---

## Lo que **no** entra en esta spec

- Cambio de skin en caliente sin recrear el motor (`setSkin()` en el handle).
- El toggle de tema claro/oscuro y su `localStorage['theme']`.
- El leaderboard propio del original (`localStorage['tetris-records']`, `bestCombo`, `maxLines`).
- El selector de "nivel inicial" del menú de pausa.
- La pantalla de inicio propia (`#start-overlay`) y el menú de pausa propio (`#pause-menu`).
- Controles táctiles o de móvil, sonido.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica.
- Pausa automática al perder el foco.
- Guardar la preferencia de skin en Supabase.
- Reescribir el texto `short`/`long` de la ficha `caida`.
- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- `/frontend-design`, rediseño del marco del reproductor, tests automatizados e i18n.

Cada uno de esos puntos, si llega, va en su propia spec.
