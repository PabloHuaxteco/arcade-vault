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
| `rocas` | `asteroids` | ❌ | ❌ | ❌ | — | 2026-09-12 | Sin skins. Vectorial: `#fff` en balas/nave/asteroides, `rgba()` en estelas/llama/partículas, hex por tipo de power-up. |
| `bloque-buster` | `arkanoid` | ❌ | ❌ | ❌ | — | 2026-09-12 | Sin skins. Pinta desde `public/games/arkanoid/spritesheet-breakout.png` vía `COLOR_MAP` — requiere recoloreado por composición de canvas, no hex directos. |

## Convenciones

- `clasico` es siempre el aspecto **actual** del juego en el momento en que `skin-designer`
  lo procesa por primera vez — nunca se reinterpreta ni se "mejora".
- ✅ significa implementado y verificado (`npm run lint` + `npm run build` en verde,
  probado en `/juego/<id>/jugar`); ❌ significa que ese skin todavía no existe para ese juego.
- Una fila solo se actualiza cuando el usuario invoca a `skin-designer` nombrando ese juego
  explícitamente — este archivo no se completa de una sola pasada sobre el catálogo.
