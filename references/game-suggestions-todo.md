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
| 2026-09-12 | `fusion` (FUSIÓN) | PUZZLE | En espera | Deslizar/fusionar fichas numéricas (tipo 2048); score = suma de fusiones. Esfuerzo bajo. Cover nueva. |
| 2026-09-12 | `triada` (TRIADA) | PUZZLE | En espera | Match-3 con cascadas y multiplicador de combo; score = gemas × cascada. Esfuerzo medio. Cover nueva. |
| 2026-09-12 | `minas` (MINAS) | PUZZLE | En espera | Buscaminas con racha de tableros crecientes; score = celdas seguras × racha. Esfuerzo bajo-medio (medio si se exige generador sin adivinanzas). |
| 2026-09-12 | `asfalto` (ASFALTO) | ARCADE | En espera | Carretera de 4 carriles con tráfico y scroll continuo; score = distancia + adelantamientos. Cubre el color magenta. Esfuerzo medio. |
| 2026-09-12 | `fuga` (FUGA) | ARCADE | En espera | Runner lateral infinito (salto/deslizamiento); score = distancia × racha. Esfuerzo bajo. |
| 2026-09-12 | `vertigo` (VÉRTIGO) | ARCADE | En espera | Descenso por túnel procedural que se estrecha, con puertas; score = distancia + puertas. Esfuerzo bajo. |
| 2026-09-12 | `martillazo` (MARTILLAZO) | ARCADE | En espera | Whack-a-mole por teclado (rejilla 3×3) con combo por velocidad de golpe. Esfuerzo bajo. Cubre el color magenta. |
| 2026-09-12 | `destello` (DESTELLO) | PUZZLE | En espera | Simón dice (secuencia de destellos creciente); score = destellos reproducidos × velocidad. Esfuerzo bajo. |
| 2026-09-12 | `pulso` (PULSO) | ARCADE | En espera | Juego de ritmo con carriles y ventanas de acierto; requiere `AudioContext` sintetizado para no sentirse vacío. Esfuerzo medio. |
| 2026-09-12 | `ascenso` (ASCENSO) | ARCADE | En espera | Climber vertical infinito con plataformas proceduales; score = altura alcanzada (encaje casi perfecto con el leaderboard). Cubre el color magenta. Favorito del agente de plataformas. Esfuerzo bajo-medio. |
| 2026-09-12 | `inversion` (INVERSIÓN) | PUZZLE | En espera | Plataformas de precisión sin salto, invirtiendo gravedad; salas autoradas (10-12 layouts). Esfuerzo medio. |
| 2026-09-12 | `andamios` (ANDAMIOS) | ARCADE | En espera | Plataformas de una pantalla con vigas inclinadas y escaleras (estilo Donkey Kong; requiere reskin abstracto por IP). Esfuerzo medio-alto. |
| 2026-09-12 | `horda` (HORDA) | ARCADE | En espera | Arena top-down con oleadas convergiendo hacia el jugador; score = enemigos × multiplicador de oleada. Cubre el color magenta. Favorito del agente de roguelike. Esfuerzo bajo-medio. |
| 2026-09-12 | `descenso` (DESCENSO) | PUZZLE | En espera | Roguelike por turnos en rejilla 20×15 con salas generadas; score = oro + enemigos + profundidad. Esfuerzo medio. |
| 2026-09-12 | `cripta` (CRIPTA) | SHOOTER | En espera | Dungeon crawler en tiempo real, salas con plantillas a mano; score = enemigos + oro + bonus sin daño. Sube a 3 fichas SHOOTER, valorar reclasificar a ARCADE. Esfuerzo medio-alto. |
| 2026-09-12 | `guardianes` (GUARDIANES) | PUZZLE | En espera | Tower defense por carriles con energía regenerativa (sin recolección manual) y guardianes de durabilidad limitada. Cubre PUZZLE y magenta a la vez. Favorito del agente de estrategia. Esfuerzo medio. |
| 2026-09-12 | `nucleo` (NÚCLEO) | ARCADE | En espera | Defensa radial: anillo rotatorio alrededor de un núcleo central. Esfuerzo bajo-medio. |
| 2026-09-12 | `torres-neon` (TORRES NEÓN) | PUZZLE | En espera | Tower defense clásico de camino fijo con waypoints, oro y dos tipos de torre. Esfuerzo alto (economía de 4 variables acopladas). |
| 2026-09-12 | `hoyo-neon` (HOYO NEÓN) | PUZZLE | En espera | Mini-golf cenital infinito con apuntado/potencia por teclado; score = hoyo + golpes ahorrados + multiplicador. Favorito del agente de deportes. Esfuerzo medio. |
| 2026-09-12 | `pinbola` (PINBOLA) | ARCADE | En espera | Pinball de una pantalla con flippers; requiere decidir ratio (4:3 nativo vs `.game-canvas-pinbola` propio). Esfuerzo alto (colisión de flippers). |
| 2026-09-12 | `penales` (PENALES) | VERSUS | En espera | Tanda de penales infinita contra portero IA; único candidato que llena VERSUS con score global real (a diferencia de `duelo-pixel`). Esfuerzo bajo-medio. |
| 2026-09-12 | `misiles` (MISILES) | SHOOTER | En espera | Defensa antimisil con detonaciones en cadena; score = misiles interceptados × oleada. **Casi idéntico a `bateria`** (propuesto por otro agente en la misma ronda sin coordinarse) — elegir uno de los dos, no ambos. Esfuerzo medio. |
| 2026-09-12 | `alunizaje` (ALUNIZAJE) | ARCADE | En espera | Lunar lander con terreno procedural y aterrizajes de precisión; solapa parcialmente con `rocas` (nave con inercia). Esfuerzo bajo-medio. |
| 2026-09-12 | `cubos` (CUBOS) | PUZZLE | En espera | Pirámide isométrica tipo Q*bert; introduce proyección isométrica, sin precedente en el repo. Esfuerzo medio-alto. |
| 2026-09-12 | `bateria` (BATERÍA) | SHOOTER | En espera | Defensa antimisil con detonaciones en cadena. **Casi idéntico a `misiles`** (propuesto por otro agente en la misma ronda sin coordinarse) — elegir uno de los dos, no ambos. Esfuerzo bajo-medio. |
| 2026-09-12 | `picado` (PICADO) | SHOOTER | En espera | Shoot-'em-up de scroll vertical con jefes; se solapa conceptualmente con `invasores` (ya `Propuesto`). Esfuerzo medio. |
| 2026-09-12 | `enjambre` (ENJAMBRE) | SHOOTER | En espera | Twin-stick simplificado en arena cerrada; riesgo de parecerse a `rocas` si no se blindan los diferenciadores. Esfuerzo medio. |

Veredictos: `Propuesto` · `En espera` · `Descartado` · `Implementado`.

## Criterios aprendidos

- (preferencias del usuario recogidas en rondas anteriores)
- **2026-09-12** — El usuario pidió una ronda de brainstorming masivo: 9 instancias de `game-planner` lanzadas en paralelo, cada una con un enfoque de género asignado (puzzle, plataformas, carreras, ritmo, roguelike, estrategia/tower-defense, deportes, clásicos reinterpretados, shooter variado), con instrucción explícita de **no escribir memoria** durante esa ronda para evitar condiciones de carrera entre instancias — la consolidación y escritura final la hizo el orquestador después, en esta entrada. Si se repite este patrón, seguir asignando un enfoque distinto por instancia para minimizar duplicados (aun así hubo uno: `misiles` / `bateria`).
- La `Propuesta activa` (`invasores`) no cambia por esta ronda: estas 27 filas son opciones adicionales `En espera` para que el usuario elija cuál promover a `Propuesto`, no un reemplazo de la recomendación en curso.
