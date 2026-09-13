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
| `serpentina` | `snake` | ❌ | ❌ | ❌ | — | 2026-09-12 | Sin skins. Color hoy: 3 hex inline en `drawSnake()` (`lib/games/snake/engine.ts:302-323`). |
| `rocas` | `asteroids` | ✅ | ✅ | ✅ | — | 2026-09-12 | `clasico`: peor 4.06:1 — **excepción documentada** (ver abajo); resto ≥ 6.19:1. `retro` (fósforo ámbar): peor 4.58:1 (anillo de escudo `#ffcf6b` en su alpha mínima 0.55); resto ≥ 6.72:1. `neon`: peor 5.00:1 (anillo `#39ffb0` a alpha 0.55); resto ≥ 6.00:1. Skin en caliente vía `AsteroidsHandle.setSkin()`, sin perder la partida. |
| `bloque-buster` | `arkanoid` | ❌ | ❌ | ❌ | — | 2026-09-12 | Sin skins. Pinta desde `public/games/arkanoid/spritesheet-breakout.png` vía `COLOR_MAP` — requiere recoloreado por composición de canvas, no hex directos. |

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

## Convenciones

- `clasico` es siempre el aspecto **actual** del juego en el momento en que `skin-designer`
  lo procesa por primera vez — nunca se reinterpreta ni se "mejora".
- ✅ significa implementado y verificado (`npm run lint` + `npm run build` en verde,
  probado en `/juego/<id>/jugar`); ❌ significa que ese skin todavía no existe para ese juego.
- Una fila solo se actualiza cuando el usuario invoca a `skin-designer` nombrando ese juego
  explícitamente — este archivo no se completa de una sola pasada sobre el catálogo.
