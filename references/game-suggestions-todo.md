# Memoria del agente `game-planner`

Archivo de memoria persistente del subagente `game-planner` (`.claude/agents/game-planner.md`).
Lo lee al arrancar y lo actualiza al terminar cada ronda. No editar a mano salvo para corregir
un veredicto.

## Propuesta activa

_(vacío — ninguna ronda ejecutada todavía)_

## Historial de sugerencias

| Fecha | Juego propuesto | Categoría | Veredicto | Razón resumida |
|---|---|---|---|---|
| 2026-09-12 | `rocas` (ROCAS) | SHOOTER | Implementado | Motor `asteroids`, SPEC 05. |
| 2026-09-12 | `caida` (CAÍDA) | PUZZLE | Implementado | Motor `tetris`, SPEC 07. |
| 2026-09-12 | `bloque-buster` (BLOQUE BUSTER) | ARCADE | Implementado | Motor `arkanoid`, SPEC 08. |
| 2026-09-12 | `serpentina` (SERPENTINA) | ARCADE | Implementado | Motor `snake`, SPEC 09. |
| 2026-09-12 | `duelo-pixel` (DUELO PIXEL) | VERSUS | En espera | En catálogo sin motor; falta definir puntuación de un versus 1v1 para el leaderboard. |
| 2026-09-12 | `gloton` (GLOTÓN) | ARCADE | En espera | En catálogo sin motor; sin carpeta de referencia en `references/started-games/`. |
| 2026-09-12 | `invasores` (INVASORES) | SHOOTER | En espera | En catálogo sin motor; sin carpeta de referencia en `references/started-games/`. |
| 2026-09-12 | `ranaria` (RANARIA) | ARCADE | En espera | En catálogo sin motor; sin carpeta de referencia en `references/started-games/`. |

Veredictos: `Propuesto` · `En espera` · `Descartado` · `Implementado`.

## Criterios aprendidos

- (preferencias del usuario recogidas en rondas anteriores)
