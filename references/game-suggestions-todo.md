# Memoria del agente `game-planner`

Archivo de memoria persistente del subagente `game-planner` (`.claude/agents/game-planner.md`).
Lo lee al arrancar y lo actualiza al terminar cada ronda. No editar a mano salvo para corregir
un veredicto.

## Propuesta activa

**`invasores` (INVASORES)** — SHOOTER, propuesta el 2026-09-12.

- En catálogo con cover ya resuelto (`.cover-invaders`), sin motor.
- Mecánica: filas de aliens en formación que descienden y se desplazan lateralmente rebotando en los bordes, disparando proyectiles aleatorios; nave del jugador con movimiento horizontal, disparo vertical y 2-3 refugios destructibles. La velocidad de descenso sube con cada oleada limpiada.
- Puntuación: score entero creciente por alien destruido (más puntos en filas de atrás) + bonus por oleada completada — encaja directo en el leaderboard de Supabase.
- Motor: canvas 2D simple, `requestAnimationFrame` único, colisiones AABB, sin assets nuevos; snapshot `{score, lives, wave, over}` similar al de `asteroids`.
- No duplica a `rocas` (asteroides es free-roam con gravedad cero; invasores es formación fija con refugios).
- Riesgos: sin carpeta en `references/started-games/` (motor diseñado desde cero, no port literal); cuidado con el `dt` en el timing de aceleración al quedar pocos aliens; decidir si los refugios entran en el alcance de la spec.
- Esfuerzo estimado: medio.
- Siguiente paso: `/spec-game invasores`.

## Historial de sugerencias

| Fecha | Juego propuesto | Categoría | Veredicto | Razón resumida |
|---|---|---|---|---|
| 2026-09-12 | `rocas` (ROCAS) | SHOOTER | Implementado | Motor `asteroids`, SPEC 05. |
| 2026-09-12 | `caida` (CAÍDA) | PUZZLE | Implementado | Motor `tetris`, SPEC 07. |
| 2026-09-12 | `bloque-buster` (BLOQUE BUSTER) | ARCADE | Implementado | Motor `arkanoid`, SPEC 08. |
| 2026-09-12 | `serpentina` (SERPENTINA) | ARCADE | Implementado | Motor `snake`, SPEC 09. |
| 2026-09-12 | `duelo-pixel` (DUELO PIXEL) | VERSUS | En espera | Descartado esta ronda: 1v1 local de paletas (Pong) no tiene score natural creciente para leaderboard global; necesitaría redefinirse como modo contra IA con marcador acumulado. |
| 2026-09-12 | `gloton` (GLOTÓN) | ARCADE | En espera | Alternativa considerada esta ronda: Pac-Man-like, buen score por pellet, pero pathfinding de fantasmas sube el esfuerzo a medio-alto. |
| 2026-09-12 | `invasores` (INVASORES) | SHOOTER | Propuesto | Recomendación principal de esta ronda: cover ya resuelto, score natural, no duplica a `rocas`. Ver "Propuesta activa". |
| 2026-09-12 | `ranaria` (RANARIA) | ARCADE | En espera | Alternativa considerada esta ronda: Frogger-like, motor simple, pero la puntuación (score por cruces) necesita definirse mejor. |

Veredictos: `Propuesto` · `En espera` · `Descartado` · `Implementado`.

## Criterios aprendidos

- (preferencias del usuario recogidas en rondas anteriores)
