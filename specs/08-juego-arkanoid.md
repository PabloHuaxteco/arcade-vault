# SPEC 08 — Juego de Arkanoid real para la ficha `bloque-buster`

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-11
> **Objetivo:** Adaptar el juego de `references/started-games/04-arkanoid/` a la plataforma como motor real jugable de la ficha `bloque-buster`, añadiendo una entrada al registro `engine → componente` de `app/juego/[id]/jugar/page.tsx` junto a `asteroids` y `tetris`.

---

## 1 — Por qué existe esta spec

SPEC 05 y SPEC 07 dejaron dos juegos reales (`rocas`/`asteroids`, `caida`/`tetris`) y seis fichas con el reproductor falso `<GamePlayer>`. Entre ellas está `bloque-buster` (ARCADE, `cover-bricks`, cyan), cuyo texto ("Rebota la pelota y destruye muros de neón") ya describe un Arkanoid — es la ficha reservada para este motor, igual que `caida` lo estaba para Tetris.

`references/started-games/04-arkanoid/` es un Arkanoid/Breakout completo: canvas 2D de 800×600, bucle propio con `requestAnimationFrame`, paleta controlada por mouse y teclado, bola con rebote físico contra paredes/paleta/ladrillos, 3 niveles con grids de ladrillos por color, sprites cargados desde un spritesheet, efecto de explosión al romper un ladrillo y sonido con mute. Es un script global con estado a nivel de módulo, sin puntuación ni vidas (perder la bola es game over inmediato) y con overlay de HUD/game-over dibujado en el propio canvas.

Esta spec porta ese juego a la arquitectura del proyecto, lo enchufa a la ficha `bloque-buster` existente (solo se le añade `engine: "arkanoid"`, sin tocar título ni textos) y añade una tercera entrada al registro `engine → componente` que SPEC 07 ya dejó resuelto. Como en SPEC 05/07, no se usa `/frontend-design`: `cover-bricks` ya existe y encaja, y se reutilizan `.crt`, `.player-hud`, `.btn`, `.modal`, `.game-canvas`.

---

## 2 — Alcance

**Dentro:**

- `references/started-games/04-arkanoid/` (hoy sin trackear) se añade al repositorio como material de referencia.
- `lib/games.ts`: el union `engine?: "asteroids" | "tetris"` pasa a `engine?: "asteroids" | "tetris" | "arkanoid"`, actualizando los dos casts literales `(g.engine as "asteroids" | "tetris" | null) ?? undefined` (en `getGames()` y `getGameById()`) a `(g.engine as "asteroids" | "tetris" | "arkanoid" | null) ?? undefined`.
- Migración Supabase (`apply_migration`): `update public.games set engine = 'arkanoid' where id = 'bloque-buster';`. No es un `insert` — la fila `bloque-buster` ya existe desde el seed de SPEC 06 con título, textos, categoría, portada (`cover-bricks`) y color (cyan) ya correctos; solo se activa su motor. `best`, `plays`, `title`, `short`, `long`, `cat`, `cover`, `color` no se tocan.
- `lib/games/arkanoid/engine.ts`: el juego portado a TypeScript.
  - Constantes puras a nivel de módulo: `GAME_W`, `GAME_H`, `LEVELS` (los 3 niveles con sus grids y `ballSpeed`), `COLOR_MAP`, `BRICK_H`, `BRICK_TOP`, `BRICK_SCORE` (puntos fijos por ladrillo roto, nuevo — el original no puntúa), `EXPLOSION_DURATION`, `EXPLOSION_FRAMES`, `SPRITES` (coordenadas del spritesheet, portadas de `assets/spritesheet.js`).
  - Todo el estado de partida (`phase`, `level`, `score` [nuevo], `paddle`, `ball`, `bricks`, `explosions`) vive dentro de una fábrica `createArkanoidGame(canvas, opts)`.
  - `opts`: `{ onState: (s: ArkanoidSnapshot) => void }`.
  - Devuelve un `ArkanoidHandle` con `start()`, `pause()`, `resume()`, `restart()`, `end()`, `destroy()`, misma forma que `AsteroidsHandle`/`TetrisHandle`.
  - `start()` ata los listeners `keydown`/`keyup` (flechas + `A`/`D`, `Space`) y arranca el `requestAnimationFrame`; se dispara automáticamente al montar el wrapper, sin pantalla de inicio propia, igual que asteroides/tetris.
  - `dt` se calcula en segundos (clamp `0.05` como asteroides/tetris); las velocidades de bola (`ballSpeed` por nivel: 5/6/7) y de paleta (`speed: 7`) se convierten de px/frame a px/segundo durante el port (multiplicando por 60, el framerate de referencia implícito del original), ya que el original mueve por frame (`b.x += b.vx`, `p.x -= p.speed`) sin `dt`.
  - `preventDefault` de flechas/`Space` solo mientras la partida está activa (`playing`), nunca en `won`/`lost` ni en pausa.
  - Se elimina el dibujo de HUD en canvas (`drawHUD` con el nivel y el indicador `MUTE`) y el overlay de fin (`drawOverlay` con "GANASTE"/"PERDISTE" y "Pulsa R para reiniciar") — el snapshot alimenta la barra `.player-hud` y el modal de React.
  - Se elimina el reinicio por tecla `R`: el único camino de reinicio es `handle.restart()` desde el modal de la plataforma.
  - Se elimina el sistema de audio completo (`SOUNDS`, `audio`, `loadSounds`, `playSound`) y el mute con tecla `M` (`state.muted`), incluidas las llamadas a `playSound("bounce")`/`playSound("break")` en las colisiones.
  - Se elimina el control por mouse (`mousemove`, `mousedown` sobre el canvas): solo sobrevive el teclado.
  - Se conservan: la física de rebote (paredes, techo, paleta con ángulo según offset de impacto, ladrillos con lado de impacto por solapamiento mínimo), los 3 niveles con sus grids y colores tal cual, el spritesheet (`assets/spritesheet-breakout.png`, sin los sonidos) y el efecto de explosión de ladrillo (frames del spritesheet, efímero, dibujado en el canvas — igual criterio que los temporizadores de power-up en asteroides).
  - `score` es un campo nuevo: cada ladrillo roto suma `BRICK_SCORE` puntos fijos, sin distinción de color.
  - No hay campo `lives`: perder la bola (cruzar el borde inferior) pasa `phase` a `lost` y termina la partida de inmediato, igual que en el original. Completar el nivel 3 sin ladrillos pasa `phase` a `won`.
  - `onState(snapshot)` se invoca solo cuando cambia `score`, `level` o el flag de fin (`over`), nunca por frame.
- `app/_components/games/arkanoid-game.tsx` (`"use client"`): wrapper de React, calcado de `asteroids-game.tsx`/`tetris-game.tsx`.
  - `<canvas className="game-canvas">` de 800×600 dentro de `.crt`/`.crt-screen`, reutilizando la misma clase que asteroides (mismo aspect ratio 4/3, sin regla nueva).
  - `.player-hud` con `.hud-stat`: Jugador, Puntuación, Nivel (sin Vidas — el juego no las tiene).
  - Botones `.btn` PAUSA/REANUDAR, FIN, SALIR (`router.push("/juego/bloque-buster")`), igual que asteroides/tetris.
  - Escucha propia de `KeyP`/`Escape` para alternar pausa, atada en el mismo `useEffect` que crea el motor.
  - Modal "FIN DEL JUEGO" igual que asteroides/tetris: `insertScore({ gameId: game.id, name, score })` desde `lib/scores-client.ts` (nunca `lib/scores.ts`), toast de guardado o error inline reutilizando `.toast-saved`, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`. El modal se abre tanto si `phase` es `won` como `lost` (ambos casos son `over: true` en el snapshot).
- `app/juego/[id]/jugar/page.tsx`: se amplía el registro `ENGINES` existente (`{ asteroids: AsteroidsGame, tetris: TetrisGame }`) con `arkanoid: ArkanoidGame`.
- `public/games/arkanoid/`: se mueven ahí el spritesheet (`spritesheet-breakout.png`) referenciado por el motor con ruta absoluta (`/games/arkanoid/spritesheet-breakout.png`). Los mp3 de sonido no se mueven — se eliminan del port.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- El sistema de audio completo (`ball-bounce.mp3`, `break-sound.mp3`) y el mute con tecla `M`.
- El control por mouse de la paleta: solo sobrevive el teclado (flechas/`A`-`D`).
- Vidas múltiples: se mantiene el comportamiento del original (1 vida, game over inmediato al perder la bola). No hay campo `lives` en el snapshot ni en el HUD.
- Puntuación por color/fila de ladrillo: el score es un valor fijo por ladrillo, sin escalar por color como en asteroides por tamaño de fragmento.
- Niveles adicionales o generación procedural de niveles: se portan los 3 niveles fijos del original tal cual (mismos grids, colores y `ballSpeed`).
- El reinicio por tecla `R` y el overlay de HUD/game-over dibujado en canvas del original.
- Controles táctiles o de móvil.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica.
- Pausa automática al perder el foco o cambiar de pestaña.
- Reescribir el texto `short`/`long` de la ficha `bloque-buster`: ya describe correctamente este motor, no hace falta tocarlo.
- Sin auth real, sin contador de `plays`, sin rate limiting en el `insert` de puntuaciones, sin realtime — mismas exclusiones de SPEC 05/06/07.
- Tests automatizados (no hay runner configurado), i18n, rediseño visual y `/frontend-design`.

---

## 3 — Modelo de datos

### Campo `engine` ampliado en `lib/games.ts`

```ts
export interface Game {
  // ...campos existentes...
  engine?: "asteroids" | "tetris" | "arkanoid";
}
```

`bloque-buster` recibe `engine: "arkanoid"` vía `update`, no vía `insert`.

### Snapshot y handle del motor (`lib/games/arkanoid/engine.ts`)

```ts
export interface ArkanoidSnapshot extends GameSnapshot {
  level: number; // 1-indexado para el HUD (state.level + 1 internamente)
}

export interface ArkanoidHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: ArkanoidSnapshot) => void }
): ArkanoidHandle;
```

Reutiliza `GameSnapshot`/`HudStat` de `lib/games/types.ts` (creado en SPEC 07, no se toca). `stats` se construye dentro del motor en cada `onState`: `[{ l: "Puntuación", v: String(score) }, { l: "Nivel", v: String(level) }]` — `score` también viaja en el campo `score` de `GameSnapshot` (el `.hud-stat` de Puntuación es redundante con ese campo pero explícito, igual que en el snapshot de Tetris respecto a `lines`/`level`).

Convenciones:

- Coordenadas: origen arriba-izquierda, mundo fijo `800×600` (igual que asteroides), velocidades en px/segundo tras la conversión desde px/frame del original.
- El canvas mantiene `width={800} height={600}`; el tamaño visible lo da la clase `.game-canvas` ya existente (`aspect-ratio: 4 / 3`).
- El motor no importa nada de `next/*` ni de React: recibe un `HTMLCanvasElement`.
- El wrapper es la única isla `"use client"` nueva de este juego; la página `jugar` sigue siendo Server Component.
- El spritesheet se referencia con ruta absoluta `/games/arkanoid/spritesheet-breakout.png` (movido de `assets/` a `public/games/arkanoid/`).

---

## 4 — Plan de implementación

1. **Referencia y campo de datos.** Añadir `references/started-games/04-arkanoid/` al repositorio. En `lib/games.ts`: ampliar `engine?: "asteroids" | "tetris" | "arkanoid"` y actualizar los dos casts en `getGames()`/`getGameById()`. Migración `update public.games set engine = 'arkanoid' where id = 'bloque-buster';`. Verificación: `npx tsc --noEmit` compila; `select engine from games where id='bloque-buster'` devuelve `'arkanoid'`; `/juego/bloque-buster/jugar` sigue mostrando el reproductor falso (aún no hay entrada para `arkanoid` en el registro).
2. **Assets.** Mover `spritesheet-breakout.png` a `public/games/arkanoid/spritesheet-breakout.png`. Verificación: el archivo es accesible en `/games/arkanoid/spritesheet-breakout.png` sirviendo `npm run dev`.
3. **Motor portado — sprites, niveles y bucle.** Crear `lib/games/arkanoid/engine.ts` con las constantes (`GAME_W`, `GAME_H`, `LEVELS`, `COLOR_MAP`, `BRICK_H`, `BRICK_TOP`, `BRICK_SCORE`, `EXPLOSION_DURATION`, `EXPLOSION_FRAMES`, `SPRITES`), la carga de spritesheet (portada de `assets/spritesheet.js` con la ruta absoluta nueva) y `createArkanoidGame(canvas, opts)` con el estado de partida encapsulado (`phase`, `level`, `score`, `paddle`, `ball`, `bricks`, `explosions`). Implementar `start()`/`destroy()` (arranca/cancela el `requestAnimationFrame`, sin listeners todavía) y `draw()` (ladrillos, explosiones, paleta, bola, sin HUD de texto ni overlay). Verificación: `npx tsc --noEmit` compila; montado en una página de prueba, se ven los ladrillos del nivel 1 y la bola pegada a la paleta.
4. **Física, input y control de partida.** Portar `clampPaddle`, `moveBall` (convertido a `dt` en segundos), `ballPaddleCollision`, `ballBrickCollision`, `advanceLevel`, `checkPhase` (con `score += BRICK_SCORE` al romper un ladrillo). Añadir listeners `keydown`/`keyup` (flechas + `A`/`D`, `Space`), atados en `start()` y quitados en `destroy()`, con `preventDefault` solo en `phase === "playing"`. Implementar `pause()`/`resume()` (sin salto de `dt`), `restart()` (reinicio en caliente, elimina el reinicio con `R` del original), `end()` (fuerza `phase = "lost"`). `onState` emite `ArkanoidSnapshot` solo al cambiar `score`/`level`/`over`. Verificación: `npx tsc --noEmit`; jugar manualmente en la página de prueba: mover con flechas, lanzar con `Space`, romper ladrillos y ver que la bola rebota correctamente en paredes/paleta/ladrillos, la puntuación sube y el nivel avanza al limpiar todos los ladrillos.
5. **Regla CSS del canvas.** No hace falta ninguna — se reutiliza `.game-canvas` de `app/globals.css` (mismo 800×600, 4/3, tal como asteroides). Verificación: `npm run build` en verde, sin cambios en `app/globals.css`.
6. **Wrapper — canvas y HUD.** Crear `app/_components/games/arkanoid-game.tsx` (`"use client"`): estructura `.crt`/`.crt-screen` con el `<canvas className="game-canvas">`. `useEffect` que crea el handle, llama `start()` y hace `destroy()` en el cleanup. `.player-hud` con Jugador (`useSession()`), Puntuación y Nivel del snapshot. Botones PAUSA/REANUDAR, FIN, SALIR (`router.push("/juego/bloque-buster")`) y escucha de `KeyP`/`Escape`. Verificación: `npx tsc --noEmit`; el componente importa sin romper el render de servidor.
7. **Wrapper — modal de fin y guardado.** Mismo patrón que `asteroids-game.tsx`/`tetris-game.tsx`: modal "FIN DEL JUEGO" (se abre tanto en `won` como en `lost`) con `insertScore({ gameId: game.id, name, score })` de `lib/scores-client.ts`, error inline si falla, JUGAR DE NUEVO → `handle.restart()`, VOLVER AL VAULT → `router.push("/biblioteca")`. Verificación: pulsar FIN o perder la bola abre el modal; GUARDAR crea una fila nueva en `scores` (comprobable con `execute_sql`).
8. **Registro `engine → componente`.** Modificar `app/juego/[id]/jugar/page.tsx`: añadir `arkanoid: ArkanoidGame` al objeto `ENGINES` ya existente (`{ asteroids: AsteroidsGame, tetris: TetrisGame }`). Verificación: `/juego/bloque-buster/jugar` muestra el canvas jugable de Arkanoid; `/juego/rocas/jugar` y `/juego/caida/jugar` siguen funcionando sin cambios; `/juego/serpentina/jugar` (sin `engine`) sigue con `<GamePlayer>`.
9. **Cierre.** Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde. Repaso manual en `/juego/bloque-buster/jugar`: jugar una partida, romper ladrillos, limpiar un nivel, perder la bola, ver el modal, guardar la puntuación y comprobar que aparece en `/salon` (pestaña BLOQUE BUSTER) tras recargar.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `lib/games/arkanoid/engine.ts` no importa nada de `react` ni de `next/*`.
- [ ] La ficha `bloque-buster` tiene `engine = 'arkanoid'` en `public.games`; `rocas` sigue con `'asteroids'` y `caida` con `'tetris'`.
- [ ] `/juego/bloque-buster/jugar` renderiza un `<canvas>` jugable dentro del marco `.crt`; `←`/`→` (o `A`/`D`) mueven la paleta y `Space` lanza la bola.
- [ ] Mover la paleta con el mouse no tiene ningún efecto (el control por mouse se eliminó del port).
- [ ] Al romper un ladrillo, la puntuación de la barra HUD sube en `BRICK_SCORE` puntos y se ve el efecto de explosión sobre el canvas.
- [ ] La bola rebota correctamente contra las paredes laterales, el techo, la paleta (con ángulo según el punto de impacto) y los ladrillos (invirtiendo el eje correcto según el lado de impacto).
- [ ] Al limpiar todos los ladrillos de un nivel que no es el último, el nivel de la barra HUD sube y aparece el siguiente grid de ladrillos.
- [ ] Al limpiar el nivel 3 (el último), la partida termina en estado "ganado" y aparece el modal "FIN DEL JUEGO".
- [ ] Si la bola cruza el borde inferior del canvas, la partida termina de inmediato (sin vidas de repuesto) y aparece el modal "FIN DEL JUEGO".
- [ ] La barra `.player-hud` muestra Jugador, Puntuación y Nivel, actualizados desde el snapshot del motor (no con un `setInterval`); no hay un cuarto stat de Vidas.
- [ ] El botón PAUSA (o las teclas `P`/`Escape`) congela el juego; REANUDAR (o la misma tecla) lo continúa sin salto de posición de la bola ni de la paleta.
- [ ] Mientras el juego está en pausa o en fin de partida, pulsar las flechas o `Space` no bloquea el scroll de la página.
- [ ] En el modal, GUARDAR PUNTUACIÓN inserta una fila en `scores` (`{ game_id: "bloque-buster", name, score }`) vía `insertScore` de `lib/scores-client.ts` y muestra el toast de guardado.
- [ ] Si el `insert` de la puntuación falla, se muestra un error inline en el modal sin perder la partida ni navegar fuera.
- [ ] Guardar una puntuación desde el modal la hace aparecer en `/salon` (pestaña BLOQUE BUSTER) tras recargar la página.
- [ ] En el modal, JUGAR DE NUEVO reinicia la partida (nivel 1, puntuación a 0, ladrillos completos) sin recargar la ruta; VOLVER AL VAULT navega a `/biblioteca`.
- [ ] El botón SALIR navega a `/juego/bloque-buster`.
- [ ] No suena ningún audio ni existe indicador de mute en pantalla.
- [ ] Al navegar fuera de `/juego/bloque-buster/jugar`, el bucle `requestAnimationFrame` y los listeners de teclado se han retirado (no hay doble bucle al volver a entrar, comprobable en el rendimiento y en la consola).
- [ ] `app/juego/[id]/jugar/page.tsx` usa el registro `ENGINES` ampliado con `arkanoid: ArkanoidGame`; `/juego/rocas/jugar` y `/juego/caida/jugar` siguen funcionando sin cambios de comportamiento.
- [ ] Los juegos sin `engine` (por ejemplo `serpentina`) siguen mostrando `<GamePlayer>` sin cambios.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** reusar la ficha `bloque-buster` ya existente en Supabase (título, textos, categoría, portada y color sin cambios), añadiendo solo `engine: 'arkanoid'` vía `update`. Su texto ya describe este juego; crear una ficha nueva habría duplicado un hueco que ya existía desde SPEC 06.
- **No:** insertar una ficha nueva para este juego. Innecesario cuando `bloque-buster` ya está reservada para esto.
- **Sí:** el id del motor es `"arkanoid"` (`engine: "arkanoid"`, `createArkanoidGame`, `lib/games/arkanoid/engine.ts`), aunque la ficha visible se llame "BLOQUE BUSTER". Coherente con que `rocas` usa `"asteroids"` y `caida` usa `"tetris"` — el id técnico nombra el género/mecánica, no el nombre de marketing de la ficha.
- **Sí:** `cover-bricks` se reutiliza tal cual, sin pasar por `/frontend-design`. Ya existe y describe exactamente este juego (ladrillos), igual criterio que `cover-tetro` en SPEC 07.
- **Sí:** ampliar el registro `ENGINES` de `app/juego/[id]/jugar/page.tsx` (ya resuelto en SPEC 07) con una tercera entrada, en vez de volver a una cadena de `if`. Es exactamente el patrón que ese registro existe para soportar.
- **Sí:** puntuación nueva con puntos fijos por ladrillo (`BRICK_SCORE`), sin distinguir color. El original no puntúa en absoluto; un valor fijo es la opción más simple que aun así hace útil el leaderboard, sin inventar una jerarquía de valores por color que el original no sugiere.
- **No:** puntuación escalada por color/fila del ladrillo (como asteroides por tamaño de fragmento). Se descartó por simplicidad: el original no da ninguna pista de qué colores deberían valer más.
- **Sí:** mantener 1 vida fiel al original — perder la bola termina la partida de inmediato. Es el comportamiento explícito de la referencia (`checkPhase` pasa a `lost` en el primer cruce del borde inferior); añadir vidas múltiples habría sido inventar una mecánica que el original no tiene.
- **No:** vidas múltiples (p.ej. 3) con relanzamiento de la bola. Se prefirió fidelidad al original sobre inflar la dificultad artificialmente.
- **Sí:** HUD con solo Puntuación y Nivel (2 `.hud-stat`, además de Jugador). No hay un tercer dato relevante que el juego produzca sin inventarlo (no hay vidas, no hay combo).
- **Sí:** solo teclado (flechas/`A`-`D` para mover, `Space` para lanzar), eliminando el control por mouse del original. Coherente con el patrón ya establecido por asteroides y tetris (ambos solo-teclado) y evita duplicar la lógica de input en el motor.
- **No:** conservar el mouse como entrada alternativa. Habría sido la única divergencia del patrón solo-teclado de los motores existentes sin una razón de jugabilidad que lo justifique.
- **Sí:** eliminar el sistema de audio completo (`ball-bounce.mp3`, `break-sound.mp3`, mute con tecla `M`). Mismo criterio que asteroides y tetris, que tampoco tienen sonido; mantenerlo aquí habría sido la única divergencia sin equivalente en el resto de la plataforma.
- **No:** portar el audio y el mute. Descartado por consistencia con los dos motores anteriores.
- **Sí:** conservar el efecto de explosión de ladrillo (frames del spritesheet) en el canvas. Es información efímera ligada a la escena, mismo criterio que los temporizadores de power-up en asteroides.
- **Sí:** eliminar el reinicio por tecla `R` y el overlay de HUD/game-over dibujado en canvas (`drawHUD`, `drawOverlay`). Los sustituyen por completo `.player-hud` y el modal "FIN DEL JUEGO" de la plataforma, como en asteroides/tetris.
- **Sí:** portar los 3 niveles fijos del original tal cual (mismos grids, colores, `ballSpeed`), sin niveles adicionales ni generación procedural. Mantiene el port fiel y acotado; una progresión más larga es una spec aparte si se pide.
- **Sí:** mover el spritesheet a `public/games/arkanoid/` con ruta absoluta. Sigue la trampa documentada en `contrato-plataforma.md` (f.7) para assets con rutas relativas hardcodeadas.
- **Sí:** reutilizar `.game-canvas` sin ninguna regla CSS nueva. El canvas del original ya es 800×600 (4/3), idéntico al de asteroides — no hay conflicto de aspect ratio como sí lo hubo con Tetris (que necesitó una decisión aparte en SPEC 07).
- **Sí:** `dt` en segundos con clamp `0.05`, igual que asteroides/tetris, convirtiendo las velocidades de px/frame a px/segundo (×60) durante el port. Evita que el juego corra a distinta velocidad según el framerate del monitor.
- **Sí:** `insertScore` desde `lib/scores-client.ts`, nunca desde `lib/scores.ts`, siguiendo la trampa ya documentada en el contrato sección (e).

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                   | Mitigación                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El bucle `requestAnimationFrame` o los listeners de teclado no se limpian al navegar y queda un bucle fantasma.                          | `handle.destroy()` se llama en el cleanup del `useEffect`; cancela el `requestAnimationFrame` y quita `keydown`/`keyup`. Criterio de aceptación dedicado.                                                               |
| `preventDefault` de flechas/`Space` bloquea el scroll del resto de la página.                                                            | Solo se aplica en `phase === "playing"`, nunca en pausa ni `won`/`lost`; listeners retirados al desmontar.                                                                                                              |
| La conversión de velocidades de px/frame a px/segundo (×60) introduce un error sutil y la física se siente distinta a la referencia.     | Se documenta el factor de conversión explícito en el plan (paso 4) antes de escribir el código, y el criterio de aceptación de rebotes se verifica jugando manualmente contra la referencia.                            |
| `onState` invocado cada frame satura React de renders y baja los FPS.                                                                    | Se emite solo cuando cambian `score`/`level`/`over`, igual que asteroides/tetris.                                                                                                                                       |
| El spritesheet no carga tras mover la ruta a `public/games/arkanoid/` y el canvas queda en blanco.                                       | Se verifica el acceso directo a la URL del asset en el paso 2 del plan, antes de portar la lógica que lo consume.                                                                                                       |
| Eliminar el control por mouse deja algún listener o referencia muerta en el port (`canvas.addEventListener("mousemove", ...)` olvidado). | El plan (paso 4) enumera explícitamente qué listeners del original se portan (solo teclado); el criterio de aceptación de "mover con mouse no tiene efecto" lo verifica manualmente.                                    |
| Next 16 trata `params` como `Promise` y `PageProps` es un global generado.                                                               | `app/juego/[id]/jugar/page.tsx` ya usa `await params` y `PageProps<"/juego/[id]/jugar">`; esta spec solo añade una entrada al registro `ENGINES` ya existente. Revisar `node_modules/next/dist/docs/` antes de tocarla. |

---

## Lo que **no** entra en esta spec

- El sistema de audio (`ball-bounce.mp3`, `break-sound.mp3`) y el mute con tecla `M`.
- El control por mouse de la paleta.
- Vidas múltiples: se mantiene 1 vida, fiel al original.
- Puntuación escalada por color/fila de ladrillo.
- Niveles adicionales o generación procedural más allá de los 3 fijos del original.
- El reinicio por tecla `R` y el overlay de HUD/game-over en canvas.
- Controles táctiles o de móvil.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica.
- Pausa automática al perder el foco.
- Reescribir el texto `short`/`long` de la ficha `bloque-buster`.
- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- `/frontend-design`, rediseño del marco del reproductor, tests automatizados e i18n.

Cada uno de esos puntos, si llega, va en su propia spec.
