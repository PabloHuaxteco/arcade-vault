# Cobertura de skins por juego

Memoria persistente del agente `skin-designer` (`.claude/agents/skin-designer.md`). La lee
antes de tocar cualquier motor y la actualiza al terminar cada juego que procesa — incluso
si el resultado es una excepción documentada en vez de una implementación completa. No
editar a mano salvo para corregir un dato incorrecto.

Todo skin `neon`/`retro` nuevo debe superar un ratio de contraste **≥ 4.5:1 contra `#000`**
(fondo real de `.game-canvas`), calculado con la fórmula de luminancia relativa de WCAG. La
columna "Notas de contraste" registra el peor ratio de cada skin o la excepción concreta si
no se alcanzó.

## Estado por juego

| Juego (`id`) | `engine` | `clasico` | `retro` | `neon` | Extras | Fecha | Notas de contraste |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `caida` | `tetris` | ✅ (ya existía como `"retro"`, pendiente renombrar) | ✅ (paleta actual, pendiente re-autorar identidad fósforo) | ✅ (ya existía) | `pastel`, `pixel` | 2026-09-12 | Sin calcular todavía — Tetris tenía skins antes de que existiera este registro; falta pasar la paleta actual por el chequeo de contraste. |
| `serpentina` | `snake` | ✅ | ✅ | ✅ | — | 2026-09-12 | `clasico`: congela los 5 hex originales (`#9dffb0` 17.4:1, `#22c55e` 9.22:1, `#ff2d55` 5.26:1) + hoja de frutas sin tintar; el fotograma apagado del parpadeo (`#0f2f16`, 1.44:1) es **excepción documentada** (ver abajo). `retro` (fósforo ámbar): peor 5.49:1 (fruta tintada `#ffb000` en su suelo de luminancia); contorno `#c07a12` 5.53:1, resto ≥ 8.05:1. `neon`: peor 4.94:1 (fruta tintada `#f7ff4d` en su suelo); cuerpo `#ff2fb3` 6.30:1, cabeza `#66fff5` 17.2:1. Skin en caliente vía `SnakeHandle.setSkin()`, sin perder la partida. Frutas recoloreadas por composición (`ctx.filter` + `multiply` + `destination-in`) cacheadas una vez por skin. |
| `rocas` | `asteroids` | ✅ | ✅ | ✅ | — | 2026-09-12 | `clasico`: peor 4.06:1 — **excepción documentada** (ver abajo); resto ≥ 6.19:1. `retro` (fósforo ámbar): peor 4.58:1 (anillo de escudo `#ffcf6b` en su alpha mínima 0.55); resto ≥ 6.72:1. `neon`: peor 5.00:1 (anillo `#39ffb0` a alpha 0.55); resto ≥ 6.00:1. Skin en caliente vía `AsteroidsHandle.setSkin()`, sin perder la partida. |
| `salta-charcos` | `frogger` | ✅ | ✅ | ✅ | — | 2026-09-13 | `clasico`: congela los 18 hex originales sin tocar uno; su primer plano más flojo es el tronco `#8a5a2b` (3.58:1) — **excepción documentada** (ver abajo), junto con los nichos (`#1d5a2a` 2.55:1, `#2f6b3c` 3.29:1) y los ojos `#0f2f16` (1.44:1); el resto va de 5.76:1 (`#ff2d55`) a 19.37:1. `retro` (fósforo ámbar, 5 tonos + ojo): peor **5.02:1** (ojo `#b36b00`, 3.50:1 sobre el cuerpo `#ffe9b5`); troncos y coches lentos `#c9761a` 6.09:1, resto ≥ 7.62:1. `neon` (río frío / carretera cálida + glow 12 px): peor **5.76:1** (rana muriendo `#ff2d55`); coches magenta `#ff2fb3` 6.31:1, troncos `#c77dff` 7.81:1, resto ≥ 7.01:1. Fondos de zona (orillas, río, mediana, carretera, pista del reloj) son superficies, no primer plano. Skin en caliente vía `FroggerHandle.setSkin()`, sin perder la partida. |
| `bloque-buster` | `arkanoid` | ✅ | ✅ | ✅ | — | 2026-09-12 | Único juego que pinta el 100% desde spritesheet: los skins recolorean la hoja por composición (`screen` + `color` + `destination-in`), cacheada una vez por skin. `clasico`: hoja intacta, peor 1.00:1 — **excepción documentada** (ver abajo). `retro` (fósforo ámbar): peor **4.82:1** (bola), paleta 4.96:1, ladrillos y explosiones ≥ 5.69:1. `neon`: peor **5.10:1** (bola), ladrillos ≥ 5.27:1, explosiones ≥ 6.54:1. Skin en caliente vía `ArkanoidHandle.setSkin()`, sin perder la partida. |

## Excepciones de contraste

- **`rocas` / `asteroids`, skin `clasico`, anillo de escudo.** El anillo pulsa con
  `alpha = 0.55 + 0.25 * sin(t)` sobre el verde original `#43e0a0`
  (`lib/games/asteroids/engine.ts`, `Ship.draw`). En el valle del pulso (alpha 0.55) el
  color compuesto sobre `#000` da **4.06:1**, por debajo del umbral; en la cresta
  (alpha 0.80) sube a 7.93:1. No se corrige **porque `clasico` congela el aspecto vigente
  del juego sin alterar un solo valor**. Los skins `retro` y `neon` sí superan el umbral en
  el valle del pulso (4.58:1 y 5.00:1) porque su anillo parte de un tono más luminoso.
- Los ratios de las partículas de explosión se calculan a **alpha 1** en los tres skins: su
  desvanecimiento a 0 es una animación de muerte transitoria (`ttl / life`), no un color de
  reposo.
- **`serpentina` / `snake`, fotograma apagado del parpadeo de muerte (los tres skins).** Al
  morir, la serpiente alterna cada 100 ms entre un tono encendido y uno apagado
  (`drawSnake`, `phase === "dying"`). El fotograma apagado —`#0f2f16` en `clasico` (1.44:1),
  `#5a2c00` en `retro` (1.79:1), `#320a24` en `neon` (1.20:1)— está **por debajo del umbral
  a propósito**: su función es desaparecer contra el fondo durante 400 ms, no ser legible.
  El fotograma encendido, que es el que porta la información, supera 4.5:1 en los tres
  skins (5.26:1, 8.05:1 y 7.01:1). En `clasico` además es intocable por definición.
- **`serpentina` / `snake`, hoja de frutas (`public/games/snake/fruits.png`).** En `retro` y
  `neon` la hoja se recolorea por composición de canvas (gris con suelo de luminancia vía
  `ctx.filter`, `multiply` del tono del skin y `destination-in` para recuperar el alfa),
  cacheada una vez por skin al primer uso. Los ratios registrados (5.49:1 ámbar, 4.94:1
  lima) corresponden al **suelo del rango de luminancia** del sprite, es decir su píxel
  opaco más oscuro; los píxeles de borde con alfa parcial (antialiasing del sprite
  original) quedan por debajo, igual que en `clasico`, y no se consideran color de reposo.
  En `clasico` la hoja se dibuja sin tocar, con sus colores frutales originales.
- **`salta-charcos` / `frogger`, skin `clasico`, troncos, nichos y ojos.** El tronco del
  río `#8a5a2b` (3.58:1), el nicho libre `#1d5a2a` (2.55:1), el nicho ocupado `#2f6b3c`
  (3.29:1) y los ojos de la rana `#0f2f16` (1.44:1) quedan por debajo del umbral. **No se
  corrigen porque `clasico` congela el aspecto vigente del juego sin alterar un solo
  valor**; los cuatro elementos se leen en su contexto real (tronco sobre el río `#0a2540`,
  nichos sobre la caja `#123a1b`, ojos sobre el cuerpo `#22c55e`), no sobre negro puro. En
  `retro` y `neon` los cuatro superan 4.5:1 contra `#000` (5.02:1 el peor).
- **`salta-charcos` / `frogger`, fondos de zona (los tres skins).** Los rellenos de orilla,
  río, mediana, carretera y la pista vacía de la barra de tiempo (`clockTrack`, `#000` en
  los tres skins) son **superficies de fondo sobre las que se pinta el primer plano**, no
  elementos legibles: se mantienen entre 1.05:1 y 1.47:1 a propósito, porque subirlos
  hundiría el contraste de todo lo que va encima. Se miden solo los colores de primer
  plano: plataformas, vehículos, rana, ojos, marcadores de nicho y barra de tiempo.
- **`salta-charcos` / `frogger`, fotograma apagado del parpadeo de muerte (los tres
  skins).** Al morir, la rana alterna cada 100 ms entre un tono encendido y uno apagado
  (`drawFrog`, `phase === "dying"`). El fotograma apagado —`#5a0f1e` en `clasico` (1.52:1),
  `#4a2200` en `retro` (1.52:1), `#3a0a16` en `neon` (1.23:1)— está **por debajo del umbral
  a propósito** y se dibuja sin glow: su función es desaparecer contra el fondo durante los
  500 ms de `DEATH_FLASH_MS`, no ser legible. El fotograma encendido, que porta la
  información, supera 4.5:1 en los tres skins (5.76:1, 9.02:1 y 5.76:1). Mismo criterio ya
  aplicado en `serpentina`.
- **`bloque-buster` / `arkanoid`, skin `clasico`, spritesheet completo.** El motor no tiene
  un solo color literal: dibuja todo desde `public/games/arkanoid/spritesheet-breakout.png`.
  Muestreados los píxeles opacos reales de la hoja, varios cuerpos de ladrillo quedan por
  debajo del umbral — gris `#323142` (1.65:1, 30% del sprite), magenta `#632ff4` (3.24:1,
  52%), rojo `#c02a3e` (3.64:1, 52%) — igual que el humo de las viñetas de explosión
  (`#360d59` 1.36:1, `#531313` 1.47:1, `#5b0b22` 1.52:1) y el contorno negro `#000000`
  horneado en el arte (8-30% de cada sprite, 1.00:1). **No se corrige porque `clasico`
  congela el aspecto vigente del juego sin alterar un solo valor**, y el arte no se puede
  retocar sin crear un asset nuevo.
- **`bloque-buster` / `arkanoid`, método de recoloreado de `retro` y `neon`.** Cada región
  de sprite se recolorea en un canvas offscreen en cuatro pasos: dibujo del original,
  `screen` con un gris (`floor`) que sube el piso de luminancia, `color` con el tono del
  skin (sustituye matiz y saturación conservando la luminosidad, así sobrevive el bisel del
  sprite) y `destination-in` para restaurar el alfa. Como `screen` es monótono, **el píxel
  más oscuro posible del resultado es el propio `floor` ya tintado**: eso acota
  matemáticamente el peor contraste del skin, y por eso los ratios de la tabla cubren
  *todos* los píxeles opacos, incluido el contorno negro que en `clasico` da 1.00:1. Los
  ladrillos se dibujan con 1 px de recorte por lado (`brickInset`) para que el negro del
  fondo siga haciendo de junta entre piezas contiguas. Las viñetas de explosión de `gray`
  son las mismas de `red` en el arte original, así que comparten su tinte en los tres skins.

## Convenciones

- `clasico` es siempre el aspecto **actual** del juego en el momento en que `skin-designer`
  lo procesa por primera vez — nunca se reinterpreta ni se "mejora".
- ✅ significa implementado y verificado (`npm run lint` + `npm run build` en verde,
  probado en `/juego/<id>/jugar`); ❌ significa que ese skin todavía no existe para ese juego.
- Una fila solo se actualiza cuando el usuario invoca a `skin-designer` nombrando ese juego
  explícitamente — este archivo no se completa de una sola pasada sobre el catálogo.
