# SPEC 10 — Controles táctiles para los 4 juegos existentes

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-09-13
> **Objetivo:** Añadir una barra de controles táctiles (D-pad + botones de acción) debajo del canvas de los 4 motores existentes (`asteroids`, `tetris`, `arkanoid`, `snake`), visible solo en dispositivos con puntero táctil, reutilizando el estado de teclado que ya tiene cada motor.

---

## 1 — Por qué existe esta spec

Los 4 motores reales (SPEC 05/07/08/09) dependen exclusivamente de `window.addEventListener("keydown"/"keyup", ...)`. En un dispositivo táctil sin teclado físico esos juegos son literalmente injugables: el canvas y el marco `.crt` ya escalan de forma responsive (media queries existentes en `app/globals.css`), pero no hay ninguna forma de mover la nave, la paleta, la pieza o la serpiente con el dedo. Esta spec no rediseña la plataforma ni los motores — añade una capa de entrada alternativa que dispara exactamente el mismo estado interno que ya dispara el teclado.

Los botones de plataforma (PAUSA/FIN/SALIR, GUARDAR PUNTUACIÓN, etc.) ya son elementos `<button>` HTML normales y por tanto ya son táctiles — no se tocan en esta spec.

No se usa `/frontend-design`: esta spec añade un componente funcional nuevo (controles), no una pantalla ni una revisión visual de marca.

---

## 2 — Alcance

**Dentro:**

- Un componente compartido nuevo `app/_components/games/touch-controls.tsx` (`"use client"`), configurable por props: recibe un arreglo `dpad` (1 a 4 botones de dirección) y un arreglo `actions` (0 a 2 botones de acción), y dos callbacks `onPress(code: string)` / `onRelease(code: string)`. No conoce nada específico de ningún juego — solo dibuja botones y reenvía `code`.
- El componente se renderiza siempre en el DOM de los 4 wrappers, pero permanece oculto por CSS excepto cuando el dispositivo cumple `@media (pointer: coarse)` — sin JS de detección, sin riesgo de mismatch de hidratación entre servidor y cliente.
- Cada botón usa Pointer Events (`onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel`), no `touchstart`/`touchend` ni `onClick`, para soportar mouse (pruebas en DevTools) y multitáctil (dos botones presionados a la vez) de forma nativa. `touch-action: manipulation` (o `none` donde aplique) en la barra evita zoom por doble-tap y scroll accidental de la página al presionar.
- Cada uno de los 4 `XxxHandle` (`AsteroidsHandle`, `TetrisHandle`, `ArkanoidHandle`, `SnakeHandle`) gana dos métodos nuevos: `press(code: string): void` y `release(code: string): void`. `code` usa los mismos strings de `KeyboardEvent.code` que el motor ya reconoce internamente (`"ArrowLeft"`, `"ArrowRight"`, `"ArrowUp"`, `"ArrowDown"`, `"Space"`).
  - **Asteroids/Arkanoid** (control por estado sostenido, `keys{}` interno): `press(code)` pone `keys[code] = true` (mismo camino que `handleKeyDown` ya usa); `release(code)` lo pone en `false` (mismo camino que `handleKeyUp`).
  - **Tetris/Snake** (control por evento discreto, sin `keyup` propio): `press(code)` ejecuta exactamente la misma lógica que hoy corre dentro de `handleKeyDown` para ese `code` (mover/rotar/soltar una vez); `release(code)` es un no-op — mismo comportamiento que ya tienen hoy con teclado físico (no reaccionan a `keyup`).
- Los 4 wrappers (`asteroids-game.tsx`, `tetris-game.tsx`, `arkanoid-game.tsx`, `snake-game.tsx`) importan `TouchControls`, lo renderizan debajo del `<canvas>` (dentro de `.crt-bottom` o en un contenedor propio nuevo, fuera de `.crt-screen`) y conectan `onPress`/`onRelease` a `handle.press`/`handle.release`.
- Configuración de botones por juego (mapeo confirmado con el usuario):
  - **Asteroids** (`rocas`): D-pad con `ArrowLeft` (◀ rotar), `ArrowRight` (▶ rotar), `ArrowUp` (▲ empuje) — sin `ArrowDown` (el motor no lo usa). Acción: `Space` (DISPARAR).
  - **Tetris** (`caida`): D-pad con `ArrowLeft`, `ArrowRight`, `ArrowDown` (mover/caída suave). Acciones: `ArrowUp` (GIRAR) y `Space` (CAÍDA RÁPIDA). `KeyX` (rotación alterna) queda fuera — no tiene botón táctil.
  - **Arkanoid** (`bloque-buster`): D-pad con `ArrowLeft`, `ArrowRight` (mover paleta). Acción: `Space` (LANZAR).
  - **Snake** (`serpentina`): D-pad completo (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`). Sin botones de acción.
- Nuevas reglas en `app/globals.css`: un bloque para `.touch-controls` (contenedor, D-pad, botones de acción) y su regla `@media (pointer: coarse) { .touch-controls { display: ...} }` / oculto por defecto. Se añade una vez y la reutilizan los 4 wrappers — ninguna otra regla existente se modifica.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Gestos táctiles (swipe/drag) directamente sobre el canvas: se descartó a favor de botones on-screen explícitos.
- Controles superpuestos sobre el propio `<canvas>`: se descartó a favor de una barra separada debajo, que no tapa el área jugable.
- Vibración háptica (`navigator.vibrate`) al presionar un botón.
- Redistribución de layout para modo landscape forzado o "gira tu dispositivo": el canvas ya escala vía las media queries existentes de `.crt`/`.game-canvas`; esta spec no cambia esas reglas.
- Soporte táctil para los juegos aún sin motor (`duelo-pixel`, `gloton`, `invasores`, `ranaria`) — no tienen `engine`, siguen con `<GamePlayer>` decorativo.
- Un layout de control configurable/editable por el jugador (elegir posición de los botones, tamaño, etc.).
- Reasignación de teclas o esquema de teclado alternativo (WASD, etc.) — sin relación con esta spec.
- Pruebas automatizadas de los controles táctiles (no hay runner configurado, igual que specs anteriores).
- Cambios al `<meta viewport>` global del layout: solo se usa `touch-action` CSS en la barra de controles, no `user-scalable=no` a nivel de página.

---

## 3 — Modelo de datos

Esta spec no introduce datos persistentes ni cambia Supabase. Extiende únicamente las interfaces de los 4 handles existentes y define la config del componente compartido.

```ts
// app/_components/games/touch-controls.tsx
export interface TouchButtonConfig {
  code: string; // mismo valor que KeyboardEvent.code, p.ej. "ArrowLeft"
  label: string; // texto/símbolo del botón, p.ej. "◀", "⟳", "⤓", "●"
}

export interface TouchControlsProps {
  dpad: TouchButtonConfig[]; // 1 a 4 entradas
  actions: TouchButtonConfig[]; // 0 a 2 entradas
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
}
```

```ts
// lib/games/asteroids/engine.ts (igual patrón en arkanoid/tetris/snake)
export interface AsteroidsHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
  press(code: string): void; // nuevo
  release(code: string): void; // nuevo
}
```

Convenciones:

- `code` es siempre un string de `KeyboardEvent.code` ya reconocido por el motor — no se inventa una taxonomía de acciones semánticas nueva (`"shoot"`, `"left"`, etc.), para no duplicar el mapeo que ya existe en cada `handleKeyDown`.
- `press`/`release` en Tetris y Snake no mantienen estado propio: delegan en las mismas funciones internas (`tryRotate()`, `hardDrop()`, cambio de dirección, etc.) que hoy invoca el `switch (e.code)` de `handleKeyDown`.
- `press`/`release` en Asteroids y Arkanoid escriben sobre el mismo objeto `keys` interno que ya leen `update()`/`draw()` cada frame — cero lógica duplicada.

---

## 4 — Plan de implementación

1. **Componente compartido y CSS base.** Crear `app/_components/games/touch-controls.tsx` con la interfaz de arriba, renderizando un D-pad (botones para los `code` presentes en `dpad`, en cruz u horizontal según cuántos haya) y hasta 2 botones de acción a la derecha. Cada botón usa `onPointerDown={() => onPress(code)}`, `onPointerUp/onPointerLeave/onPointerCancel={() => onRelease(code)}`. Añadir en `app/globals.css` el bloque `.touch-controls` (oculto por defecto) y `@media (pointer: coarse) { .touch-controls { display: flex; } }`, con `touch-action: manipulation` en los botones. Verificación: `npx tsc --noEmit` compila; montado en una página de prueba con DevTools en modo dispositivo (Ctrl+Shift+M), la barra aparece; en modo desktop normal, permanece oculta.
2. **Handle de Asteroids.** Añadir `press`/`release` a `createAsteroidsGame` reescribiendo sobre el mismo `keys` que ya usan `handleKeyDown`/`handleKeyUp`. Envolver en `app/_components/games/asteroids-game.tsx` con `<TouchControls dpad={[ArrowLeft, ArrowRight, ArrowUp]} actions={[Space]} onPress={handle.press} onRelease={handle.release} />` debajo del canvas. Verificación: en DevTools modo dispositivo, tocar los botones rota/empuja la nave y dispara, igual que con teclado; con teclado físico sigue funcionando sin cambios.
3. **Handle de Tetris.** Añadir `press`/`release` extrayendo la lógica del `switch` de `handleKeyDown` a una función interna reutilizada por ambos caminos (teclado y `press`); `release` es no-op. Envolver en `tetris-game.tsx` con D-pad `[ArrowLeft, ArrowRight, ArrowDown]` y acciones `[ArrowUp, Space]`. Verificación: tocar mueve/gira/cae la pieza una vez por tap; teclado sigue funcionando.
4. **Handle de Arkanoid.** Mismo patrón que Asteroids (estado sostenido `keys`). Envolver en `arkanoid-game.tsx` con D-pad `[ArrowLeft, ArrowRight]` y acción `[Space]`. Verificación: tocar mueve la paleta mientras se mantiene presionado y suelta al lanzar.
5. **Handle de Snake.** Mismo patrón que Tetris (evento discreto, sin estado sostenido). Envolver en `snake-game.tsx` con D-pad completo `[ArrowUp, ArrowDown, ArrowLeft, ArrowRight]`, sin acciones. Verificación: tocar cambia de dirección igual que las flechas, respetando el bloqueo de giro de 180° ya existente.
6. **Cierre.** Ejecutar `npm run lint` y `npm run build` en verde. Repaso manual en DevTools modo dispositivo (perfil móvil, Ctrl+Shift+M) para los 4 juegos: la barra aparece, cada botón reproduce el efecto de su tecla equivalente, PAUSA/FIN/SALIR siguen funcionando sin cambios, y en modo desktop (sin emulación) la barra permanece oculta y el teclado sigue controlando todo como antes.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] Ninguno de los 4 motores (`lib/games/*/engine.ts`) importa nada de `react` ni de `next/*` tras el cambio.
- [ ] `app/_components/games/touch-controls.tsx` no contiene lógica específica de ningún juego: solo recibe `dpad`/`actions`/`onPress`/`onRelease`.
- [ ] En Chrome DevTools con el device toolbar activo (Ctrl+Shift+M, cualquier perfil móvil), la barra `.touch-controls` es visible debajo del canvas en los 4 juegos (`/juego/rocas/jugar`, `/juego/caida/jugar`, `/juego/bloque-buster/jugar`, `/juego/serpentina/jugar`).
- [ ] Con el device toolbar desactivado (puntero normal de escritorio), la barra `.touch-controls` no es visible en ninguno de los 4 juegos.
- [ ] En Asteroids, mantener presionados los botones ◀/▶ rota la nave y ▲ activa el empuje mientras se mantiene; soltar detiene el efecto igual que soltar la tecla física. El botón de disparo dispara un proyectil por cada tap.
- [ ] En Tetris, tocar ◀/▶ mueve la pieza una columna por tap, tocar ▼ baja una fila, tocar GIRAR rota la pieza y tocar CAÍDA RÁPIDA la deja caer al fondo — cada uno replica exactamente el efecto de su tecla equivalente.
- [ ] En Arkanoid, mantener presionado ◀/▶ mueve la paleta mientras se sostiene el botón, y soltar detiene el movimiento; el botón LANZAR suelta la bola pegada a la paleta.
- [ ] En Snake, tocar cualquiera de las 4 direcciones cambia el rumbo de la serpiente en el siguiente tick de grid, y un giro de 180° sobre la dirección actual sigue bloqueado igual que con teclado.
- [ ] Con teclado físico conectado (o simulando teclado en un navegador de escritorio normal), los 4 juegos se controlan exactamente igual que antes de esta spec — ninguna tecla ni comportamiento existente cambió.
- [ ] Los botones PAUSA/REANUDAR, FIN y SALIR de los 4 wrappers siguen funcionando sin cambios, tanto con tap como con clic de mouse.
- [ ] Presionar dos botones táctiles a la vez (p.ej. mantener ◀ y tocar DISPARAR en Asteroids) produce ambos efectos simultáneamente, sin que uno cancele al otro.
- [ ] Tocar repetidamente los botones de la barra no dispara zoom por doble-tap ni hace scroll de la página.
- [ ] Los juegos sin `engine` (`duelo-pixel`, `gloton`, `invasores`, `ranaria`) siguen mostrando `<GamePlayer>` sin ninguna barra de controles táctiles nueva.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** alcance completo — los 4 motores existentes (asteroids, tetris, arkanoid, snake) en una sola spec, ya que comparten el mismo patrón de solución (componente + métodos `press`/`release`). Un piloto de 1-2 juegos habría dejado el resto del catálogo sin resolver sin necesidad real de acotar.
- **No:** empezar solo con un motor piloto. El patrón es idéntico para los 4 y no hay incertidumbre de diseño que justifique validar con uno antes de aplicarlo al resto.
- **Sí:** botones on-screen tipo gamepad (D-pad + acciones), mapeados 1:1 a las teclas actuales. Gestos (swipe/drag) habrían requerido definir umbrales y sensibilidad distintos por juego, con más ambigüedad y sin pedido explícito del usuario.
- **No:** gestos táctiles sobre el canvas. Descartado por ambigüedad de diseño por juego.
- **Sí:** barra de controles separada debajo del canvas, fuera de `.crt-screen`. El usuario confirmó explícitamente esta opción tras ver una referencia visual de controles superpuestos sobre el canvas y descartarla — prioriza no tapar el área jugable sobre ahorrar espacio vertical.
- **No:** controles semi-transparentes superpuestos sobre el canvas (como en la imagen de referencia inicial). Rechazado explícitamente por el usuario en favor de la barra separada.
- **Sí:** visibilidad condicionada a `@media (pointer: coarse)` en CSS puro, sin JS de detección. Evita mismatch de hidratación (SSR no puede saber de antemano el tipo de puntero) y es la señal estándar para "el input primario del dispositivo es táctil/impreciso".
- **No:** mostrar los controles siempre (también en desktop). El usuario prefirió no saturar la UI de escritorio con controles que no necesita.
- **No:** detección por JS (`matchMedia` o `ontouchstart in window`) con estado de React. Más complejidad y riesgo de parpadeo/mismatch para el mismo resultado que ya da CSS.
- **Sí:** nuevos métodos `press(code)`/`release(code)` en cada `XxxHandle`, reutilizando el estado interno (`keys{}` o las funciones que ya ejecuta `handleKeyDown`). Evita simular eventos DOM sintéticos y mantiene una sola fuente de verdad por motor.
- **No:** simular `KeyboardEvent` reales vía `dispatchEvent`. Habría funcionado, pero es más fràgil (depende de que el motor siga escuchando en `window`, dificulta pruebas unitarias futuras) frente a un método explícito en el handle.
- **Sí:** `code` como identificador de botón, igual a `KeyboardEvent.code` (`"ArrowLeft"`, `"Space"`, etc.), sin inventar una capa semántica de acciones (`"shoot"`, `"rotate"`). Mantiene un único mapeo por motor en vez de dos (uno para teclado, otro para táctil).
- **No:** una taxonomía de acciones semánticas compartida entre los 4 motores. Cada motor ya tiene su propio mapeo de `code` a comportamiento; duplicarlo con nombres semánticos habría sido una capa de indirección sin beneficio.
- **Sí:** componente compartido único `touch-controls.tsx`, configurable por props, reutilizado por los 4 wrappers. Evita duplicar el mismo layout/CSS 4 veces.
- **No:** marcado y CSS propios en cada wrapper. Habría duplicado la misma barra 4 veces sin necesidad.
- **Sí:** respetar la semántica tap/hold de cada motor (Asteroids/Arkanoid = mantener presionado; Tetris/Snake = un tap, una acción), igual que hoy respetan teclado sostenido vs. keydown discreto. Cambiar esta semántica habría alterado el comportamiento de juego que ya está definido en SPEC 05/07/08/09.
- **No:** forzar hold en los 4 motores. Habría requerido inventar un ritmo de auto-repetición para Tetris/Snake que ninguna spec anterior definió.
- **Sí:** Pointer Events (`onPointerDown/Up/Leave/Cancel`) en vez de `touchstart`/`touchend` u `onClick`. Unifica mouse y touch (permite probar con mouse en DevTools sin emulación), y cada botón maneja su propio `pointerId` sin bloquear otros botones presionados a la vez.
- **No:** `onClick` para los botones de acción. No sirve para el patrón "mantener presionado" de Asteroids/Arkanoid.
- **Sí:** `touch-action: manipulation` (o `none` donde aplique) en la barra, sin tocar el `<meta viewport>` global. Resuelve el problema puntual (zoom accidental al tocar los botones) sin afectar el resto de la página.
- **No:** `user-scalable=no` en el `<meta viewport>` global del layout. Afectaría a toda la plataforma, no solo a los controles de juego.
- **Sí:** verificación manual vía Chrome DevTools device toolbar (Ctrl+Shift+M), sin requerir un dispositivo físico. No necesita instalación adicional y activa `(pointer: coarse)` y los Pointer Events con `pointerType: "touch"` de forma suficiente para validar los criterios de aceptación.
- **No:** exigir prueba en dispositivo físico real como bloqueante para cerrar la spec. Queda como verificación adicional recomendada, no obligatoria.
- **No:** vibración háptica, gestos, layout configurable por el jugador, ni soporte para los juegos sin motor. Fuera de alcance explícito, ver sección 2.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@media (pointer: coarse)` no cubre el 100% de dispositivos (algunos híbridos táctil+mouse, como ciertas laptops con pantalla táctil, reportan `pointer: fine`).                               | Aceptado como limitación conocida: el objetivo de esta spec es cubrir el caso mayoritario (teléfonos/tablets sin teclado), no cada combinación de hardware. Si aparece un caso real, se ajusta en una spec futura.                               |
| Extraer la lógica de `handleKeyDown` a una función compartida en Tetris/Snake introduce una regresión sutil si el refactor cambia el orden de validaciones (colisión, rotación, etc.).         | Cada paso del plan (3 y 5) verifica manualmente que teclado físico y controles táctiles producen el mismo resultado antes de continuar.                                                                                                          |
| Mantener presionado un botón de Asteroids/Arkanoid y salir de la pestaña (o soltar el dedo fuera del botón) deja `keys[code] = true` colgado, igual que un `keyup` perdido con teclado físico. | Se usa `onPointerLeave` y `onPointerCancel` además de `onPointerUp` para liberar el estado en más casos que un teclado físico ya cubre parcialmente hoy; no es una garantía nueva, es paridad con el riesgo ya aceptado del control por teclado. |
| Doble input simultáneo (teclado físico + botón táctil en un dispositivo híbrido) podría dejar un `code` marcado como presionado por una fuente y liberado por la otra.                         | Ambas fuentes escriben sobre el mismo objeto `keys`/las mismas funciones internas — el último evento (de cualquier fuente) gana, igual que ya ocurre hoy si dos teclas físicas mapean al mismo efecto. No se introduce un caso nuevo.            |

---

## Lo que **no** entra en esta spec

- Gestos táctiles (swipe/drag) sobre el canvas.
- Controles superpuestos sobre el propio `<canvas>`.
- Vibración háptica.
- Modo landscape forzado o aviso de "gira tu dispositivo".
- Soporte táctil para juegos sin motor (`duelo-pixel`, `gloton`, `invasores`, `ranaria`).
- Layout de controles configurable por el jugador.
- Reasignación de teclas / esquema de teclado alternativo.
- Tests automatizados, `/frontend-design`, cambios al `<meta viewport>` global.

Cada uno de esos puntos, si llega, va en su propia spec.
