# GAME JAM — ÚLTIMO REBOTE (Extensión)

> **Estado:** Borrador
> **Tema:** DUELO PIXEL — 1v1 local de paletas estilo Pong
> **Depende de:** 01-ultimo-rebote-mvp.md (implementada y en verde)
> **Fecha:** 2026-09-14
> **Objetivo:** Añadir al motor `pong` las mecánicas que el MVP recortó — efecto, personalidades de rival, power-ups, racha, vida extra, jefes y el modo 1v1 local del tema original — sin romper el snapshot ni el contrato de plataforma.

---

## 1 — Por qué existe esta spec

El MVP deja un duelo completo y publicable: paleta, rival IA, escalera infinita, marcador acumulado y leaderboard real. Lo que no tiene es **variedad entre rivales**: el rival #7 es el rival #1 más rápido y con menos margen de error. Casi todas las mecánicas cortadas del MVP tienen la misma función — hacer que subir de rival cambie el problema, no solo su velocidad — y por eso viven juntas aquí en vez de dispersas en un "fuera de alcance" muerto.

La excepción deliberada es el **modo 1v1 local** (3.7): es el tema literal recibido ("DUELO PIXEL — 1v1 local de paletas"), y se recuperó aquí porque tiene sentido como modo de exhibición aunque no alimente el leaderboard. El MVP no podía incluirlo sin romper la premisa de score global comparable; esta spec lo reintroduce con reglas explícitas de no-guardado.

Esta spec no toca la ficha de Supabase, ni `lib/games.ts`, ni el registro `ENGINES`, ni `app/globals.css`. Todo el trabajo es interno a `lib/games/pong/engine.ts` más ajustes acotados en `app/_components/games/pong-game.tsx` para el HUD y el selector de modo.

---

## 2 — Alcance

**Dentro:**

- Efecto (spin) transferido por el movimiento vertical de la paleta al golpear (3.1).
- Personalidades de rival: `muro`, `agresivo`, `cortador` (3.2).
- Rival jefe cada 5 rivales, con paleta doble (3.3).
- Power-ups de duelo: paleta encogida, pelota doble, muro central, pelota rápida (3.4).
- Racha de devoluciones consecutivas con multiplicador de puntuación (3.5).
- Vida extra por rival derrotado, con tope (3.6).
- Modo 1v1 local a dos jugadores en el mismo teclado, sin guardado de puntuación (3.7).
- Dificultad progresiva avanzada: paleta del jugador que encoge por tramo y tabla de parámetros por rival en vez de incremento lineal (3.8).
- Reorganización del HUD para seguir respetando el máximo de 3 `HudStat` además de "Jugador" (3.9).
- `npm run lint` y `npm run build` en verde.

**Fuera de alcance — sigue vetado en toda la plataforma, también aquí:**

- Auth real: el nombre del jugador sigue viniendo del `localStorage` de `session-provider`.
- Contador de `plays` real: la columna sigue siendo texto estático.
- Rate limiting o validación de servidor en el `insert` de puntuaciones.
- Realtime en el leaderboard: `/salon` sigue actualizándose al recargar.
- Sonido (ni efectos ni música, ni `AudioContext`).
- Controles táctiles o de móvil (eso lo porta `mobile-porter` con el patrón de SPEC 10, no esta spec).
- Ajuste del canvas a `devicePixelRatio` o resolución dinámica.
- Tests automatizados (no hay runner configurado).
- i18n.
- Además, tampoco entran aquí: `/frontend-design`, `.cover-*` nuevas, cambios en `app/globals.css`, sprites o assets externos, skins o temas visuales (trabajo de `skin-designer`), cambios en la ficha de `public.games` ni en el registro `ENGINES`.

---

## 3 — Modelo de datos y mecánicas

Snapshot resultante tras esta spec:

```ts
export interface PongSnapshot extends GameSnapshot {
  lives: number;
  rival: number;
  streak: number; // devoluciones consecutivas sin encajar punto; nuevo en esta spec
  mode: "escalera" | "local"; // nuevo en esta spec; "escalera" es el modo del MVP
}
```

`GameSnapshot` (`score`, `over`, `stats`) y `HudStat` de `lib/games/types.ts` **no cambian**: `stats` sigue teniendo como máximo tres entradas (ver 3.9). El wrapper es quien decide qué hacer con `mode` (ocultar el guardado de puntuación en `local`).

### 3.1 — Efecto (spin)

- **Motor:** al golpear la pelota, la velocidad vertical de la paleta en ese instante (px/s, con signo) se suma a `vy` de la pelota multiplicada por `SPIN_FACTOR = 0.35`, y luego se renormaliza la rapidez total para no romper el techo `MAX_BALL_SPEED`. El ángulo resultante se clampa a `MAX_BOUNCE_RAD` para que la pelota nunca salga casi vertical y se quede rebotando entre las paredes.
- **Puntuación:** ninguna directa. Indirecta: los peloteos se alargan, así que sube el acumulado por `POINTS_RETURN`.
- **Snapshot / HUD:** sin cambios.

### 3.2 — Personalidades de rival

- **Motor:** cada rival recibe una personalidad determinista a partir de su índice (`rival % 3`), con su propio ajuste sobre los parámetros base del MVP:
  - `muro`: velocidad alta, error bajo, pero **nunca** aplica efecto y devuelve siempre cerca del centro de su paleta — peloteos largos y planos.
  - `agresivo`: error medio, pero busca golpear con el extremo de la paleta para devolver con ángulo máximo.
  - `cortador`: velocidad media y uso deliberado del efecto de 3.1, moviéndose en el momento del golpe para curvar la devolución.
- **Motor (dibujo):** la paleta rival cambia de tono según personalidad (magenta, naranja, violeta), sin texto en el canvas.
- **Puntuación:** sin cambios directos.
- **Snapshot / HUD:** la personalidad **no** entra en el snapshot; se comunica por el color de la paleta. Evita gastar una de las tres `HudStat`.

### 3.3 — Rival jefe cada 5 rivales

- **Motor:** cuando `rival % 5 === 0`, el rival es jefe: `PADDLE_H` de su paleta se divide en dos segmentos separados por un hueco central (`BOSS_GAP = 26`), de modo que el centro de su paleta **no** devuelve; además necesita `BOSS_POINTS_TO_WIN = 7` puntos en vez de 5 para caer.
- **Puntuación:** derrotar a un jefe suma `POINTS_BOSS = 1500` en vez de `POINTS_RIVAL`.
- **Snapshot / HUD:** sin campo nuevo. El stat "Rival" pasa a mostrarse como `#5★` cuando el rival actual es jefe — sigue siendo una sola `HudStat`.

### 3.4 — Power-ups de duelo

- **Motor:** cada `POWERUP_INTERVAL_S = 18` segundos de fase `playing`, aparece una cápsula en el centro del campo. La pelota que la toca activa un modificador durante `POWERUP_DURATION_S = 10`:
  - `paleta-corta`: la paleta del **rival** se reduce un 35 % (beneficio del jugador).
  - `pelota-doble`: entra una segunda pelota; los puntos y las vidas funcionan igual con cualquiera de las dos, y el rally sigue vivo mientras quede una en juego.
  - `muro-central`: aparece un bloque estático en el centro del campo que rebota ambas pelotas.
  - `pelota-rapida`: la rapidez actual sube un 25 % con el mismo techo `MAX_BALL_SPEED`.
- **Puntuación:** devolver la pelota con un power-up activo suma `POINTS_RETURN × 2`. Recoger la cápsula suma `POINTS_PICKUP = 50`.
- **Snapshot / HUD:** sin campo nuevo. El modificador activo se dibuja como un icono vectorial con su temporizador en el canvas, mismo criterio que los power-ups de asteroides.

### 3.5 — Racha de devoluciones

- **Motor:** `streak` cuenta devoluciones consecutivas del jugador sin encajar un punto. Se reinicia a 0 cuando la pelota pasa por detrás de la paleta del jugador, y **no** se reinicia al cambiar de rival ni al ganar un punto.
- **Puntuación:** el multiplicador es `mult = 1 + floor(streak / 10)`, con techo `MAX_STREAK_MULT = 5`. Se aplica a `POINTS_RETURN` y a `POINTS_POINT`, nunca a `POINTS_RIVAL` ni a `POINTS_BOSS` (esos son hitos fijos y no deben depender del azar de una racha).
- **Snapshot:** campo `streak: number`.
- **HUD:** ver 3.9.

### 3.6 — Vida extra

- **Motor:** al derrotar a un rival, si `lives < MAX_LIVES = 5`, `lives += 1`. Los jefes de 3.3 conceden la vida igual que un rival normal, no dos.
- **Puntuación:** sin cambios.
- **Snapshot / HUD:** sin campos nuevos; el stat "Vidas" ya existe desde el MVP.

### 3.7 — Modo 1v1 local

- **Motor:** `createPongGame(canvas, opts)` acepta `opts.mode: "escalera" | "local"` (por defecto `"escalera"`, el comportamiento del MVP). En `"local"`:
  - La paleta derecha deja de estar controlada por la IA y responde a `KeyW` / `KeyS`; la izquierda sigue con ↑ / ↓. Es la única situación en toda la plataforma con dos esquemas de teclado, y solo porque hay dos personas.
  - No hay vidas, ni escalera, ni rivales: se juega al primero que llegue a `LOCAL_POINTS_TO_WIN = 7`, y al llegar la fase pasa a `over`.
  - El marcador de ambos lados se dibuja como pips en el canvas, igual que el duelo del MVP.
  - `score` del snapshot se mantiene en 0 durante todo el modo local.
- **Puntuación:** **ninguna**. El modo local no produce score para el leaderboard.
- **Snapshot:** campo `mode`.
- **Wrapper:** un par de botones `.btn` sobre el marco (ESCALERA / LOCAL) recrean el handle con el modo elegido. En modo `local`, el modal de fin **no** muestra GUARDAR PUNTUACIÓN — solo JUGAR DE NUEVO y VOLVER AL VAULT — y no llama nunca a `insertScore`.

### 3.8 — Dificultad progresiva avanzada

- **Motor:** los parámetros por rival dejan de ser una fórmula lineal y pasan a una tabla `RIVAL_TIERS` de 5 tramos (velocidad de IA, error, velocidad base de pelota, personalidad forzada), que se repite cíclicamente aplicando un multiplicador creciente a partir del rival 15. Además, la paleta del jugador encoge `PLAYER_SHRINK = 6` px por cada tramo completado, con suelo `MIN_PADDLE_H = 54`.
- **Puntuación:** sin cambios directos; la dificultad sube el valor implícito de cada punto.
- **Snapshot / HUD:** sin campos nuevos.

### 3.9 — HUD dentro del límite de 3 `HudStat`

Con `streak` añadido, los candidatos serían cuatro (Puntuación, Vidas, Rival, Racha). El límite de `GameSnapshot` es tres además de "Jugador", así que:

- **Modo `escalera`:** `[Puntuación, Vidas, Rival]` mientras `streak < 10`; en cuanto el multiplicador supera 1, la entrada "Rival" pasa a mostrar `#7 ×3` (rival y multiplicador en el mismo valor formateado). Nunca se añade una cuarta entrada.
- **Modo `local`:** `[Marcador, —, —]` se reduce a una sola entrada `{ l: "Marcador", v: "3–5" }`; Puntuación y Vidas no aplican.

---

## 4 — Plan de implementación

1. **Efecto (3.1).** Añadir `SPIN_FACTOR`, la transferencia de velocidad vertical de la paleta y el clamp de ángulo. Verificación: golpear moviendo la paleta hacia arriba curva la pelota hacia arriba; la pelota nunca sale casi vertical.
2. **Personalidades (3.2).** Extraer los parámetros de la IA a una estructura por personalidad y asignarla por índice de rival, con su color de paleta. Verificación: los rivales #1, #2 y #3 se comportan y se ven distintos.
3. **Jefes (3.3).** Paleta partida con hueco central, `BOSS_POINTS_TO_WIN`, `POINTS_BOSS` y el sufijo `★` en el stat "Rival". Verificación: el rival #5 tiene hueco central, pide 7 puntos y suma 1500 al caer.
4. **Racha (3.5) y HUD (3.9).** Campo `streak` en el snapshot, multiplicador con techo y la regla de formateo del stat "Rival". Verificación: 10 devoluciones seguidas duplican los puntos por devolución y el HUD muestra `×2`; encajar un punto lo devuelve a `×1`.
5. **Vida extra (3.6).** `lives += 1` al derrotar rival con tope `MAX_LIVES`. Verificación: derrotar al rival #1 con 2 vidas sube a 3; con 5 vidas no sube.
6. **Power-ups (3.4).** Cápsula temporizada, cuatro modificadores, duración, puntos de recogida y bonus de devolución. Verificación: cada modificador se activa, dibuja su temporizador y expira sin dejar estado residual.
7. **Dificultad avanzada (3.8).** Tabla `RIVAL_TIERS`, ciclo con multiplicador y encogimiento de la paleta del jugador con suelo. Verificación: los rivales #1 a #6 recorren los cinco tramos y la paleta del jugador es visiblemente más corta en el tramo 2.
8. **Modo local (3.7).** `opts.mode`, control `KeyW`/`KeyS` de la paleta derecha, partida a 7, `score` fijo en 0, botones de modo en el wrapper y modal sin GUARDAR PUNTUACIÓN. Verificación: en modo local dos personas juegan, el modal no ofrece guardar y `scores` no recibe ninguna fila nueva.
9. **Cierre.** `npm run lint` y `npm run build` en verde, más una partida completa de escalera hasta el rival #6 y una partida local.

---

## 5 — Criterios de aceptación

- [ ] Golpear la pelota con la paleta en movimiento curva su trayectoria; el ángulo resultante nunca supera `MAX_BOUNCE_RAD`.
- [ ] Los rivales #1, #2 y #3 usan personalidades distintas, visibles por el color de su paleta.
- [ ] El rival #5 tiene el hueco central, requiere 7 puntos y suma 1500 al caer; el stat "Rival" muestra `#5★`.
- [ ] 10 devoluciones consecutivas activan el multiplicador `×2` (visible en el stat "Rival"); encajar un punto devuelve el multiplicador a `×1`.
- [ ] El multiplicador de racha no se aplica al bonus de rival derrotado ni al de jefe.
- [ ] Derrotar a un rival concede una vida extra hasta un máximo de 5.
- [ ] Cada power-up se activa al tocarlo con la pelota, dibuja su temporizador en el canvas y expira sin dejar efecto residual.
- [ ] Con un power-up activo, cada devolución suma el doble de puntos.
- [ ] La paleta del jugador encoge por tramo de rivales y nunca baja de `MIN_PADDLE_H`.
- [ ] En modo local, `KeyW`/`KeyS` mueven la paleta derecha y ↑/↓ la izquierda; la partida termina al llegar uno a 7 puntos.
- [ ] En modo local, el modal de fin **no** muestra GUARDAR PUNTUACIÓN y no se inserta ninguna fila en `scores`.
- [ ] El snapshot nunca expone más de 3 `HudStat` además de "Jugador", en ningún modo ni con ninguna combinación de mecánicas.
- [ ] `lib/games/pong/engine.ts` sigue sin importar nada de `react` ni de `next/*`.
- [ ] `lib/games/types.ts`, `lib/games.ts`, `app/globals.css`, el registro `ENGINES` y la ficha de `public.games` no cambian en esta spec.
- [ ] Al navegar fuera de `/juego/ultimo-rebote/jugar` no quedan bucles de `requestAnimationFrame` ni listeners de teclado vivos, tampoco tras cambiar de modo.
- [ ] `preventDefault` sigue aplicándose solo en fase activa, incluidas las teclas `KeyW`/`KeyS` del modo local.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** recuperar el 1v1 local como modo de exhibición sin guardado. Es el tema literal recibido y merece existir; separar el guardado por modo es más honesto que inventar un score para dos personas.
- **No:** guardar puntuación en modo local. Un marcador 7-5 entre dos personas no es comparable en una tabla global — exactamente la objeción original de `references/game-suggestions-todo.md`.
- **Sí:** `KeyW`/`KeyS` como segundo esquema de teclado, y **solo** en modo local. Es la única justificación válida para romper la regla de "un solo esquema" de la plataforma: hay dos jugadores físicos.
- **Sí:** personalidades comunicadas por color de paleta, no por una `HudStat`. El presupuesto de tres estadísticas es escaso y el color se lee sin apartar la vista del campo.
- **Sí:** multiplicador de racha fundido en el stat "Rival" (`#7 ×3`) en vez de una cuarta `HudStat`. Respeta el límite de `GameSnapshot` sin ocultar el dato.
- **No:** ampliar `GameSnapshot` a cuatro `HudStat`. Es un tipo compartido por todos los motores; cambiarlo por conveniencia de un juego es una spec de plataforma aparte, no un efecto colateral de esta.
- **Sí:** jefe con paleta partida en vez de jefe con más velocidad. Cambia el problema (hay que apuntar al centro) en vez de subir el mismo número otra vez.
- **Sí:** vida extra con tope de 5. Sin tope, un jugador competente acumularía vidas y la partida no acabaría nunca.
- **No:** power-ups que perjudican al jugador (paleta propia encogida por cápsula). Ya hay dificultad creciente por tramo; una cápsula que castiga al recogerla se siente arbitraria cuando la activa la pelota y no una decisión.
- **Sí:** multiplicador de racha limitado a `×5` y no aplicable a los bonus de rival/jefe. Evita que una sola partida afortunada distorsione el leaderboard frente a todas las demás.
- **Sí:** tabla `RIVAL_TIERS` cíclica con multiplicador en vez de fórmula lineal infinita. Permite ajustar la curva de dificultad tramo a tramo sin tocar la lógica del motor.

---

## 7 — Riesgos identificados

| Riesgo                                                                                             | Mitigación                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El efecto (3.1) deja la pelota casi vertical y el peloteo se vuelve un rebote infinito entre paredes. | El ángulo se clampa a `MAX_BOUNCE_RAD` después de aplicar el spin, y la rapidez total se renormaliza. Criterio de aceptación dedicado.                                  |
| `pelota-doble` duplica la lógica de colisión y aparecen errores de estado (puntos dobles, vidas dobles). | Las pelotas viven en un array desde el principio de esta spec; la lógica de punto se ejecuta por pelota y el rally termina cuando el array queda vacío.                 |
| Cambiar de modo en caliente deja el handle anterior vivo con su rAF y sus listeners.               | El wrapper llama a `handle.destroy()` antes de crear el handle del modo nuevo, y el `useEffect` depende del modo. Criterio de aceptación dedicado.                       |
| El modo local llama por descuido a `insertScore` y ensucia el leaderboard con marcadores locales.  | El wrapper no renderiza el botón GUARDAR PUNTUACIÓN cuando `snapshot.mode === "local"`, y el `score` del snapshot se mantiene en 0 en ese modo.                          |
| `KeyW`/`KeyS` con `preventDefault` bloquean la escritura en otros campos de la página.             | El `preventDefault` sigue acotado a la fase activa del juego y a las cuatro teclas del modo; en pausa y en `over` no se aplica.                                          |
| El multiplicador de racha rompe la comparabilidad histórica del leaderboard del MVP.               | Las puntuaciones anteriores conviven sin migración; el tope `×5` y la exclusión de los bonus de hito acotan la inflación. Decisión documentada en la sección 6.          |
| El encogimiento de paleta acumulado hace el juego imposible en tramos altos.                       | Suelo `MIN_PADDLE_H = 54` px, verificado en el paso 7 del plan jugando hasta el rival #12.                                                                               |
| Los power-ups activos al derrotar a un rival persisten en el duelo siguiente.                      | Todos los modificadores se limpian en la transición de rival, igual que en `restart()`; el paso 6 exige comprobar que no queda estado residual.                          |

---

## Lo que **no** entra en esta spec

- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- Sonido de ningún tipo.
- Controles táctiles o de móvil (patrón de SPEC 10, trabajo de `mobile-porter`).
- `devicePixelRatio` o resolución dinámica del canvas.
- Skins y temas visuales (trabajo de `skin-designer`).
- Tests automatizados e i18n.
- `/frontend-design`, `.cover-*` nuevas, cambios en `app/globals.css`, en `lib/games.ts`, en el registro `ENGINES` o en la ficha de `public.games`.
- Modo online, matchmaking o cualquier forma de multijugador remoto.

Cada uno de esos puntos, si llega, va en su propia spec.
