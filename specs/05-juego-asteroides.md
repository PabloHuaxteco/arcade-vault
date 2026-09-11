# SPEC 05 — Juego de asteroides real para la ficha `rocas`

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-10
> **Objetivo:** Adaptar el juego de `references/started-games/02-asteroids/` a la plataforma como motor real jugable de la ficha `rocas`, montado en un `<canvas>` dentro del reproductor, con el HUD, los botones y el modal de guardado de la plataforma alimentados por el estado del juego.

---

## 1 — Por qué existe esta spec

SPEC 01 dejó un reproductor **falso** (`app/_components/game-player.tsx`): el marcador y el nivel suben solos con `setInterval` sobre una pantalla CRT decorativa, y el modal "FIN DEL JUEGO" guarda una puntuación inventada en `localStorage`. Ninguno de los ocho juegos del catálogo es jugable.

`references/started-games/02-asteroids/` es un juego completo de asteroides: canvas 2D de 800×600, bucle propio con `requestAnimationFrame`, nave con inercia, asteroides que se parten, balas, partículas y dos power-ups (disparo triple y escudo). Es un script global (`game.js` + `index.html`) con estado a nivel de módulo e `window.addEventListener` de teclado.

Esta spec porta ese juego a la arquitectura del proyecto y lo enchufa **solo** a la ficha `rocas`. Los otros siete juegos siguen con el reproductor falso. No se construye un sistema genérico de motores: cuando llegue el segundo juego real se decidirá el patrón. Como en SPEC 01–03, no se usa `/frontend-design`: se reutilizan las clases de `app/globals.css` (`.crt`, `.player-hud`, `.btn`, `.modal`) y solo se añade una regla mínima para el `<canvas>`.

---

## 2 — Alcance

**Dentro:**

- `references/started-games/02-asteroids/` (hoy sin trackear) se añade al repositorio como material de referencia, igual que `references/templates/`.
- Campo opcional `engine?: "asteroids"` en la interfaz `Game` de `lib/games.ts`. La ficha `rocas` recibe `engine: "asteroids"`. Se reescribe su texto `long` para no prometer OVNIs (el motor de referencia no los tiene).
- `lib/games/asteroids/engine.ts`: el juego portado a TypeScript.
  - Clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` portadas de `game.js` con los mismos valores (radios, velocidades, puntos, TTL, cooldowns, drag, spread del triple, duración de power-ups).
  - `W` y `H` siguen siendo constantes `800` y `600`.
  - Todo el estado de partida vive dentro de una fábrica `createAsteroidsGame(canvas, { onState })`; a nivel de módulo solo quedan las constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_TYPES`, utilidades `wrap`/`dist`/`rand`/`randInt`).
  - Devuelve un handle `AsteroidsHandle` con: `start()`, `pause()`, `resume()`, `restart()`, `end()`, `destroy()`.
  - `start()` ata los listeners `keydown`/`keyup` (flechas + `Space`) y arranca el bucle `requestAnimationFrame`. `destroy()` cancela el bucle y quita los listeners.
  - El `preventDefault` de flechas y `Space` solo actúa mientras la partida está activa (estado `playing` o `dead`), nunca en `gameover` ni en pausa, para no bloquear el scroll de la página.
  - `pause()` congela el bucle (deja de programar `requestAnimationFrame` y descarta el `dt` acumulado al reanudar); `resume()` lo rearranca.
  - `end()` fuerza el estado `gameover` con la puntuación actual y emite el snapshot.
  - `restart()` reinicia la partida en caliente (equivalente al `initGame()` original) sin recrear el handle ni recargar la ruta. Se elimina el reinicio interno con la tecla `Space` del código de referencia.
  - `onState(snapshot)` se invoca **solo** cuando cambia `score`, `lives`, `level` o el flag de fin, no cada frame.
  - Se elimina del motor el dibujo de HUD de texto (`drawHUD` con SCORE/NIVEL/vidas y `drawOverlay` de GAME OVER). Se **conserva** en el canvas el dibujo de los temporizadores de power-up activos (TRIPLE/ESCUDO con su cuenta atrás).
- `app/_components/games/asteroids-game.tsx` (`"use client"`): wrapper de React.
  - `useRef` a un `<canvas width={800} height={600} className="game-canvas">` dentro de la estructura `.crt` / `.crt-screen` reutilizada del reproductor falso.
  - En un `useEffect`: `createAsteroidsGame(canvas, { onState: setSnapshot })`, `handle.start()`, y `handle.destroy()` en el cleanup.
  - Barra `.player-hud` con cuatro `.hud-stat`: Jugador (nombre de `useSession()`, `"INVITADO"` por defecto), Puntuación, Vidas y Nivel, leídos del snapshot.
  - Botones `.btn`: PAUSA/REANUDAR (llama `pause()` / `resume()` y alterna el estado local `paused`), FIN (`end()`), SALIR (`router.push("/juego/rocas")`).
  - Escucha de teclado propia del wrapper para `KeyP` y `Escape`: alternan pausa por el mismo camino que el botón. Atada en el `useEffect`, quitada en el cleanup.
  - Cuando `snapshot.over` es `true`: renderiza el `.modal` "FIN DEL JUEGO" existente, con la puntuación final, un `input` de iniciales (prefijado con el nombre de sesión, `toUpperCase().slice(0, 10)`), botón GUARDAR PUNTUACIÓN → `appendScore({ game: game.id, score, name })` y toast `.toast-saved`, botón JUGAR DE NUEVO → `handle.restart()` + limpieza del estado local (`saved`, `paused`), botón VOLVER AL VAULT → `router.push("/biblioteca")`.
- `app/juego/[id]/jugar/page.tsx`: si `game.engine === "asteroids"` monta `<AsteroidsGame game={game} />`; en caso contrario, `<GamePlayer game={game} />` como hasta ahora.
- `app/globals.css`: una regla nueva `.game-canvas` (ancho `100%`, `height: auto`, `aspect-ratio: 4 / 3`, `display: block`, `image-rendering: pixelated`, fondo negro) para el `<canvas>` dentro de `.crt-screen`.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- El enemigo OVNI que dispara: ausente en el código de referencia. Se implementará en su propia spec y por eso se ajusta el texto `long` de `rocas`.
- Guardar la puntuación en Supabase o en un ranking global. Se sigue usando `localStorage` (`av_scores`) vía `appendScore`. SPEC 04 dejó solo el plumbing de Supabase.
- Adaptar los otros siete juegos del catálogo o construir un registro genérico `id → motor`. El enganche aquí es un único campo `engine` y una rama en la página `jugar`.
- Controles táctiles o de móvil: el juego es solo teclado, como el original.
- Sonido.
- Ajuste del canvas a `devicePixelRatio` o canvas de resolución dinámica que redimensione el mundo. La resolución interna es fija 800×600 y se escala por CSS.
- Pausa automática al perder el foco o cambiar de pestaña.
- Tests automatizados (no hay runner configurado), i18n, rediseño visual y `/frontend-design`.

---

## 3 — Modelo de datos

No hay estructuras persistentes nuevas. El guardado de puntuación reutiliza `appendScore({ game: "rocas", score, name })` de `lib/storage.ts` (clave `localStorage["av_scores"]`, SPEC 01), sin cambios de formato ni de versión.

### Campo nuevo en `lib/games.ts`

```ts
export interface Game {
  // ...campos existentes...
  engine?: "asteroids"; // si está, la ruta /juego/[id]/jugar monta el motor real
}
```

Solo `rocas` lo lleva en esta spec.

### Snapshot que el motor emite al wrapper

```ts
// lib/games/asteroids/engine.ts
export interface AsteroidsSnapshot {
  score: number;
  lives: number;
  level: number;
  over: boolean; // true cuando el estado interno es 'gameover'
}

export interface AsteroidsHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: AsteroidsSnapshot) => void }
): AsteroidsHandle;
```

Convenciones:

- Coordenadas del juego: origen arriba-izquierda, mundo fijo de 800×600, velocidades en px/segundo (igual que `game.js`).
- El canvas mantiene `width={800} height={600}` como sistema de coordenadas; el tamaño visible lo da CSS.
- El motor no importa nada de `next/*` ni de React: es un módulo de DOM puro que recibe un `HTMLCanvasElement`.
- El wrapper es la única isla `"use client"` nueva; la página `jugar` sigue siendo Server Component.
- Los `className` del marco (`.crt`, `.crt-screen`, `.crt-bottom`, `.player-hud`, `.hud-stat`, `.hud-actions`, `.btn`, `.modal`, `.modal-bd`, `.toast-saved`) son los ya existentes en `app/globals.css`. La única regla nueva es `.game-canvas`.

---

## 4 — Plan de implementación

1. **Referencia y campo de datos.** Añadir `references/started-games/02-asteroids/` al repositorio. En `lib/games.ts`: añadir `engine?: "asteroids"` a `Game`, poner `engine: "asteroids"` en la ficha `rocas` y reescribir su `long` para que no mencione OVNIs. Verificación: `npx tsc --noEmit` compila; `/juego/rocas/jugar` sigue mostrando el reproductor falso (aún no se ramifica).
2. **Motor portado — clases y bucle.** Crear `lib/games/asteroids/engine.ts` con `AsteroidsSnapshot`, `AsteroidsHandle` y `createAsteroidsGame(canvas, { onState })`. Portar de `game.js` las utilidades, las constantes y las clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp` sin cambiar valores, y encapsular el estado de partida (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, timers) dentro de la fábrica. Implementar `start()` (arranca `requestAnimationFrame`) y `destroy()` (lo cancela). Sin listeners de teclado todavía. Mantener `draw()` tal cual salvo que se quitan `drawHUD` y `drawOverlay` y se deja solo el dibujo de los temporizadores de power-up. Verificación: `npx tsc --noEmit` compila; montado en una página de prueba, los asteroides se mueven y se parten al no haber input.
3. **Input y control de partida.** Añadir a `createAsteroidsGame`: listeners `keydown`/`keyup` para flechas y `Space`, atados en `start()` y quitados en `destroy()`, con `preventDefault` solo en estado `playing`/`dead`. Métodos `pause()`, `resume()`, `restart()` (reinicio en caliente, elimina el reinicio con `Space` del original) y `end()` (fuerza `gameover`). Invocar `onState` solo al cambiar `score`, `lives`, `level` o el fin de partida. Verificación: `npx tsc --noEmit`; `pause()` congela el movimiento y `resume()` lo reanuda sin salto brusco.
4. **Regla CSS del canvas.** Añadir `.game-canvas` a `app/globals.css` (ancho `100%`, `height: auto`, `aspect-ratio: 4 / 3`, `display: block`, `image-rendering: pixelated`, fondo negro). Verificación: `npm run build` en verde; la regla aún no se usa.
5. **Wrapper — canvas y HUD.** Crear `app/_components/games/asteroids-game.tsx` (`"use client"`): estructura `.av-player` → `.player-hud` + `.crt`/`.crt-screen` con el `<canvas className="game-canvas">`. `useEffect` que crea el handle, llama `start()` y hace `destroy()` en el cleanup; `useState` para el snapshot y para `paused`. HUD con Jugador (`useSession()`), Puntuación, Vidas y Nivel del snapshot. Botones PAUSA/REANUDAR, FIN y SALIR (`router.push("/juego/rocas")`). Escucha de `KeyP`/`Escape` para alternar pausa. Verificación: `npx tsc --noEmit`; el componente importa sin romper el render de servidor.
6. **Wrapper — modal de fin y guardado.** En `asteroids-game.tsx`, cuando `snapshot.over`: renderizar el `.modal` "FIN DEL JUEGO" con la puntuación final, `input` de iniciales prefijado con el nombre de sesión, GUARDAR PUNTUACIÓN → `appendScore({ game: game.id, score, name })` + `.toast-saved`, JUGAR DE NUEVO → `handle.restart()` y reinicio del estado local, VOLVER AL VAULT → `router.push("/biblioteca")`. Verificación: pulsar FIN abre el modal; GUARDAR añade una entrada a `localStorage["av_scores"]`.
7. **Ramificar la página `jugar`.** Modificar `app/juego/[id]/jugar/page.tsx`: si `game.engine === "asteroids"`, renderizar `<AsteroidsGame game={game} />`; si no, `<GamePlayer game={game} />`. Verificación: `/juego/rocas/jugar` muestra el canvas jugable; `/juego/caida/jugar` sigue con el reproductor falso.
8. **Cierre.** Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde. Repaso manual en `/juego/rocas/jugar`: jugar una partida, agotar las tres vidas, ver el modal, guardar la puntuación y comprobar que JUGAR DE NUEVO reinicia sin recargar.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `references/started-games/02-asteroids/` está versionado en el repositorio.
- [ ] `lib/games.ts` define `engine?: "asteroids"` en `Game` y la ficha `rocas` tiene `engine: "asteroids"`; ninguna otra ficha lo tiene.
- [ ] El texto `long` de `rocas` no menciona OVNIs.
- [ ] `lib/games/asteroids/engine.ts` no importa nada de `react` ni de `next/*`.
- [ ] `/juego/rocas/jugar` renderiza un `<canvas>` jugable dentro del marco `.crt`; las flechas rotan e impulsan la nave y `Space` dispara.
- [ ] Al disparar a un asteroide grande se divide en fragmentos y la puntuación de la barra HUD aumenta según el tamaño (100 / 50 / 20).
- [ ] La barra `.player-hud` muestra Jugador, Puntuación, Vidas y Nivel, y sus valores cambian con la partida (no con un `setInterval`).
- [ ] Al limpiar todos los asteroides, el nivel de la barra HUD sube y aparecen más asteroides.
- [ ] Recoger un power-up muestra su temporizador (TRIPLE o ESCUDO) dibujado sobre el canvas con cuenta atrás.
- [ ] El botón PAUSA (o las teclas `P` / `Escape`) congela el juego; REANUDAR (o la misma tecla) lo continúa sin salto de posición.
- [ ] Mientras el juego está en pausa o en fin de partida, pulsar las flechas o `Space` no bloquea el scroll de la página.
- [ ] Al perder la última vida, o al pulsar FIN, aparece el `.modal` "FIN DEL JUEGO" con la puntuación final.
- [ ] En el modal, GUARDAR PUNTUACIÓN añade una entrada `{ game: "rocas", score, name }` a `localStorage["av_scores"]` y muestra el toast "▸ PUNTUACIÓN GUARDADA_".
- [ ] En el modal, JUGAR DE NUEVO reinicia la partida (puntuación a 0, tres vidas, nivel 1) sin recargar la ruta; VOLVER AL VAULT navega a `/biblioteca`.
- [ ] El botón SALIR navega a `/juego/rocas`.
- [ ] Al navegar fuera de `/juego/rocas/jugar`, el bucle `requestAnimationFrame` y los listeners de teclado se han retirado (no hay doble bucle al volver a entrar, comprobable en el rendimiento y en la consola).
- [ ] `/juego/caida/jugar` y el resto de juegos sin `engine` siguen mostrando el reproductor falso `<GamePlayer>` sin cambios.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** enganchar solo `rocas`, con el mínimo mecanismo (campo `engine` + una rama en la página `jugar`). El catálogo tiene un solo juego real; abstraer ahora sería adivinar el patrón antes de tener el segundo caso.
- **No:** crear ya un registro genérico `id → componente de motor`. Se decidirá cuando llegue el segundo juego real, con datos en la mano.
- **No:** reescribir el reproductor falso para asumir juegos reales en todos. Alcance mucho mayor; su propia spec.
- **Sí:** HUD (Jugador/Puntuación/Vidas/Nivel) y botones PAUSA/FIN/SALIR de la plataforma, alimentados por el estado del motor. Da coherencia visual con el reproductor falso y con el resto de la app.
- **No:** dejar el juego 100% autónomo con su HUD y su GAME OVER dibujados en el canvas. Rompía la coherencia con el marco de la plataforma y duplicaba información.
- **Sí:** conservar en el canvas solo los temporizadores de power-up. No hay hueco natural para ellos en la barra HUD y son información efímera ligada a la escena.
- **Sí:** motor en un módulo TS (`lib/games/asteroids/engine.ts`) con un wrapper de React fino. Separa la lógica de juego (DOM puro, testeable, sin React) de la integración con la ruta y el HUD.
- **No:** copiar `game.js` casi verbatim como módulo, ni meter todo dentro del componente cliente. Lo primero deja el estado a nivel de módulo (impide reinicio limpio y dos instancias); lo segundo crea un fichero enorme difícil de mantener.
- **Sí:** `onState` en cambios discretos (`score`, `lives`, `level`, `over`). Alimenta el HUD de React sin provocar 60 renders por segundo.
- **No:** que el wrapper haga polling del estado del motor en su propio `requestAnimationFrame`. Re-renderiza cada frame sin necesidad.
- **Sí:** `JUGAR DE NUEVO` del modal llama a `handle.restart()` (reinicio en caliente) y se elimina el reinicio con `Space` del código original. Un solo camino de reinicio, sincronizado con el modal.
- **Sí:** listeners de teclado atados en mount y retirados en unmount; `preventDefault` de flechas y `Space` solo mientras se juega. Evita fugas y no bloquea el scroll al navegar por la página. Pausa con `P` y `Escape` además del botón.
- **No:** listeners globales en `window` con `preventDefault` permanente, como el original. Molesta al usar el resto de la página.
- **Sí:** resolución interna fija 800×600 escalada por CSS (`aspect-ratio: 4 / 3`, `image-rendering: pixelated`). Mantiene intactas la física, los spawns y el `wrap` del motor y aun así encaja en el `.crt`.
- **No:** canvas de resolución dinámica que redimensione el mundo. Obligaría a revisar velocidades, distancias de seguridad y `wrap` sin beneficio para un primer port.
- **Sí:** seguir guardando en `localStorage` (`av_scores`) vía `appendScore`. SPEC 04 dejó Supabase solo cableado; el esquema de puntuaciones es otra spec.
- **No:** escribir la puntuación en Supabase aquí. Requiere tabla, RLS y tipos generados.
- **Sí:** omitir `/frontend-design` y reutilizar `.crt`, `.player-hud`, `.btn`, `.modal`. Mismo criterio que SPEC 01–03: se porta una interfaz existente, no se diseña una nueva.
- **Sí:** ajustar el texto `long` de `rocas` y dejar los OVNIs fuera. El código de referencia no los tiene; prometerlos en la ficha sería engañoso.
- **Sí:** versionar `references/started-games/02-asteroids/` como referencia, igual que `references/templates/`.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                  | Mitigación                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El bucle `requestAnimationFrame` o los listeners de teclado no se limpian al navegar y queda un bucle fantasma o doble. | `handle.destroy()` se llama en el cleanup del `useEffect`; cancela el `requestAnimationFrame` y quita `keydown`/`keyup`. Hay un criterio de aceptación que lo verifica.                                               |
| `preventDefault` de flechas y `Space` bloquea el scroll de la página.                                                   | Solo se aplica en estado `playing`/`dead`, nunca en pausa ni `gameover`, y los listeners se retiran al desmontar el componente.                                                                                       |
| El estado a nivel de módulo del `game.js` original impediría reiniciar limpio o montar dos instancias.                  | El port encapsula todo el estado de partida dentro de `createAsteroidsGame`; a nivel de módulo solo quedan constantes y utilidades puras.                                                                             |
| `onState` invocado cada frame satura React de renders y baja los FPS.                                                   | Se emite solo cuando cambian `score`, `lives`, `level` o el flag de fin.                                                                                                                                              |
| El canvas se ve borroso o mal escalado en pantallas HiDPI.                                                              | Resolución interna fija 800×600 + escalado por CSS con `image-rendering: pixelated`. El ajuste a `devicePixelRatio` queda fuera de alcance y anotado.                                                                 |
| Next 16 trata `params` como `Promise` y `PageProps` es un global generado.                                              | La página `app/juego/[id]/jugar/page.tsx` ya usa `await params` y `PageProps<"/juego/[id]/jugar">`; esta spec solo añade una rama. Antes de tocarla, revisar la guía de App Router en `node_modules/next/dist/docs/`. |
| El bucle sigue consumiendo CPU con la pestaña en segundo plano.                                                         | `dt` ya está capado a `0.05` y la pausa manual está disponible; la pausa automática por `visibilitychange` se deja fuera de alcance de forma explícita.                                                               |

---

## Lo que **no** entra en esta spec

- El enemigo OVNI que dispara.
- Guardado de puntuaciones en Supabase o ranking global (sigue en `localStorage`, `av_scores`).
- Adaptar los otros siete juegos o un registro genérico de motores.
- Controles táctiles o de móvil.
- Sonido.
- Canvas ajustado a `devicePixelRatio` o de resolución dinámica.
- Pausa automática al perder el foco.
- `/frontend-design`, rediseño del marco del reproductor, tests automatizados e i18n.

Cada uno de esos puntos, si llega, va en su propia spec.
