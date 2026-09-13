# GAME JAM — SALTA CHARCOS (Extensión)

> **Estado:** Borrador
> **Tema:** ranaria — un juego estilo Frogger-like (cruzar un camino/río esquivando obstáculos)
> **Depende de:** 01-salta-charcos-mvp.md (implementada y en verde)
> **Fecha:** 2026-09-12
> **Objetivo:** Añadir al motor `frogger` las mecánicas que el MVP recortó — peligros vivos, objetivos de bonus, racha de cruces, vida extra y dificultad progresiva por ronda — sin romper el snapshot ni el contrato de plataforma.

---

## 1 — Por qué existe esta spec

El MVP deja un Frogger-like completo y publicable: cruce por carriles, 3 vidas, reloj, 5 nichos y ronda que acelera. Lo que no tiene es **variedad entre rondas**: la ronda 7 es la ronda 1 un 70 % más rápida. Todas las mecánicas cortadas del MVP tienen la misma función — hacer que subir de ronda cambie el problema, no solo su velocidad — y por eso viven juntas aquí en vez de dispersas en el "fuera de alcance".

Esta spec no toca la ficha de Supabase, ni `lib/games.ts`, ni el registro `ENGINES`, ni `app/globals.css`. Todo el trabajo es interno a `lib/games/frogger/engine.ts` más ajustes menores en `app/_components/games/frogger-game.tsx` para el HUD.

---

## 2 — Alcance

**Dentro:**

- Tortugas sumergibles en el río (sección 3.1).
- Cocodrilo nadador y cocodrilo en nicho (3.2).
- Serpientes en la mediana y sobre los troncos (3.3).
- Mosca bonus y rana acompañante como objetivos de puntuación extra (3.4).
- Racha de cruces sin morir con multiplicador de puntuación (3.5).
- Vida extra por umbral de puntuación (3.6).
- Dificultad progresiva avanzada por ronda: tabla de patrones de carril, reloj decreciente y anchos de vehículo variables (3.7).
- Reorganización del HUD para seguir respetando el máximo de 3 `HudStat` además de "Jugador" (3.8).
- `npm run lint` y `npm run build` en verde.

**Fuera de alcance — sigue vetado en toda la plataforma, también aquí:**

- Auth real: el nombre del jugador sigue viniendo del `localStorage` de `session-provider`.
- Contador de `plays` real: la columna sigue siendo texto estático.
- Rate limiting o validación de servidor en el `insert` de puntuaciones.
- Realtime en el leaderboard: `/salon` sigue actualizándose al recargar.
- Sonido (ni efectos ni música, ni `AudioContext`).
- Controles táctiles o de móvil.
- Ajuste del canvas a `devicePixelRatio` o resolución dinámica.
- Tests automatizados (no hay runner configurado).
- i18n.
- Además, tampoco entran aquí: WASD o cualquier segundo esquema de teclado, `/frontend-design`, `.cover-*` nuevas, sprites o assets externos, y cambios en la ficha de `public.games`.

---

## 3 — Modelo de datos y mecánicas

Snapshot resultante tras esta spec:

```ts
export interface FroggerSnapshot extends GameSnapshot {
  lives: number;
  round: number;
  streak: number; // cruces consecutivos sin morir; nuevo en esta spec
}
```

`GameSnapshot` (`score`, `over`, `stats`) y `HudStat` de `lib/games/types.ts` no cambian.

### 3.1 — Tortugas sumergibles

- **Motor:** un tipo de plataforma nueva en los carriles de río, `kind: "turtles"`, con un ciclo propio de `SUBMERGE_CYCLE_S = 6` (4 s emergidas, 1 s de aviso parpadeando, 1 s sumergidas). Mientras están sumergidas dejan de contar como plataforma: la rana encima se ahoga. Los grupos de tortugas de un mismo carril comparten fase, pero cada grupo arranca con un desfase distinto.
- **Snapshot:** sin campos nuevos.
- **HUD:** sin cambios.
- **Puntuación:** ninguna directa; el efecto es que el jugador no puede pararse a esperar sobre cualquier plataforma, lo que sube el bonus de tiempo medio del cruce rápido.

### 3.2 — Cocodrilos

- **Motor:** dos variantes. (a) _Cocodrilo nadador_: plataforma de 3 celdas en un carril de río cuya celda de morro mata al contacto mientras el resto del lomo transporta con normalidad. (b) _Cocodrilo en nicho_: a partir de `CROC_NEST_ROUND = 3`, un nicho libre aleatorio puede estar ocupado por un cocodrilo durante `CROC_NEST_S = 5` segundos; saltar ahí cuesta una vida. El nicho con cocodrilo se dibuja con las fauces abiertas y nunca aparece en más de un nicho a la vez.
- **Snapshot:** sin campos nuevos.
- **HUD:** sin cambios.
- **Puntuación:** ninguna directa.

### 3.3 — Serpientes

- **Motor:** (a) una serpiente que patrulla la fila 5 (la mediana segura del MVP) de lado a lado a partir de `SNAKE_MEDIAN_ROUND = 2`, convirtiendo la única zona de descanso en una zona con ventana. (b) A partir de `SNAKE_LOG_ROUND = 5`, una serpiente recorre un tronco largo del río en sentido contrario a su avance. Ambas matan al contacto (AABB con la misma tolerancia de 4 px del MVP).
- **Snapshot:** sin campos nuevos.
- **HUD:** sin cambios.
- **Puntuación:** ninguna directa.

### 3.4 — Mosca bonus y rana acompañante

- **Motor:** cada `FLY_INTERVAL_S = 12` aparece, durante `FLY_LIFETIME_S = 6`, una mosca en un nicho libre aleatorio; ocupar ese nicho con la mosca presente suma `POINTS_FLY = 200` además del premio normal del nicho. En paralelo, a partir de `MATE_ROUND = 4`, una rana acompañante viaja sobre un tronco del carril inferior del río; la rana del jugador puede montarse en la misma plataforma para "recogerla" y, si llega a un nicho con ella, suma `POINTS_MATE = 200`. Se pierde si el jugador muere.
- **Snapshot:** sin campos nuevos — el estado de "llevo acompañante" se dibuja en el canvas (la rana lleva una segunda silueta encima), no en el HUD.
- **HUD:** sin cambios.
- **Puntuación:** `+200` por mosca y `+200` por acompañante, ambos acumulables con el bonus de tiempo del nicho.

### 3.5 — Racha de cruces

- **Motor:** contador `streak` que sube en 1 por cada nicho ocupado y vuelve a 0 en cada muerte. El multiplicador aplicado al premio del nicho (base + bonus de tiempo) es `1 + min(streak, 5) × 0.2`, es decir de `x1` a `x2`. No multiplica los 10 puntos por fila nueva ni el bonus de ronda, para que la racha premie cruces completos y no avances parciales.
- **Snapshot:** campo nuevo `streak: number`.
- **HUD:** el stat "Ronda" se sustituye por "Racha" (`x1` … `x2`), y el número de ronda pasa a dibujarse en el canvas junto a la barra del reloj. Ver 3.8.
- **Puntuación:** multiplica el premio de nicho; con racha máxima, un cruce perfecto y rápido vale el doble.

### 3.6 — Vida extra

- **Motor:** al cruzar cada múltiplo de `EXTRA_LIFE_EVERY = 5000` puntos, `lives += 1` con techo `MAX_LIVES = 5`. El umbral se evalúa una sola vez por múltiplo, con un contador interno del último umbral concedido.
- **Snapshot:** sin campos nuevos (`lives` ya existe).
- **HUD:** el stat "Vidas" sube; el motor emite el snapshot en ese momento, igual que en cualquier otro cambio de `lives`.
- **Puntuación:** ninguna directa; alarga la partida y, por tanto, el techo del leaderboard.

### 3.7 — Dificultad progresiva por ronda

- **Motor:** la tabla `LANES` estática del MVP pasa a una tabla `ROUND_PATTERNS` de 4 configuraciones de carril que rotan por ronda (`ROUND_PATTERNS[(round - 1) % 4]`), cambiando direcciones, huecos y anchos de vehículo (`widthCells` de 1 a 3). El reloj del cruce baja `CROSS_TIME_STEP_S = 2` por ronda con piso `MIN_CROSS_TIME_S = 16`. El multiplicador de velocidad del MVP y su techo `MAX_SPEED_MULT = 2.2` se mantienen sin cambios.
- **Snapshot:** sin campos nuevos.
- **HUD:** sin cambios (el reloj sigue siendo barra en canvas).
- **Puntuación:** indirecta — menos tiempo disponible significa menos bonus de tiempo por nicho, compensado por el multiplicador de racha.

### 3.8 — Reorganización del HUD

El contrato limita el HUD a 3 `HudStat` además de "Jugador". Tras esta spec quedan: **Puntuación**, **Vidas** y **Racha**. "Ronda" sale del HUD y se dibuja dentro del canvas junto a la barra del reloj, como información de escena. `stats` se sigue construyendo dentro del motor en cada emisión, y `emitState()` pasa a comparar `score`, `lives`, `round`, `streak` y `over`.

---

## 4 — Plan de implementación

1. **Racha y HUD.** Añadir `streak` al estado y al snapshot, el multiplicador del premio de nicho, el diff de `emitState()` y el cambio de `.hud-stat` "Ronda" → "Racha" en el wrapper, con el número de ronda dibujado en el canvas. Verificación: dos nichos seguidos sin morir muestran `x1.2` y `x1.4`; una muerte devuelve la racha a `x1`.
2. **Vida extra.** Umbral de `EXTRA_LIFE_EVERY` con techo `MAX_LIVES`. Verificación: cruzar 5000 puntos suma una vida exactamente una vez y el HUD lo refleja.
3. **Tortugas sumergibles.** Tipo de plataforma `turtles` con su ciclo y su parpadeo de aviso. Verificación: quedarse encima de un grupo hundido cuesta una vida; saltar antes del aviso no.
4. **Cocodrilos.** Variante nadadora (morro letal, lomo transportador) y variante de nicho con su temporizador. Verificación: el morro mata, el lomo transporta, y el nicho con fauces cuesta una vida.
5. **Serpientes.** Patrulla de la mediana y serpiente sobre tronco, con sus rondas de activación. Verificación: en ronda 2 la mediana deja de ser refugio permanente; en ronda 5 aparece la del tronco.
6. **Mosca y acompañante.** Aparición temporizada de la mosca en nicho libre y recogida/entrega de la rana acompañante. Verificación: ocupar el nicho con mosca suma 200 extra; entregar la acompañante suma otros 200 y se pierde al morir.
7. **Patrones por ronda y reloj decreciente.** Sustituir `LANES` por `ROUND_PATTERNS` y aplicar la reducción del reloj con su piso. Verificación: las rondas 1 a 4 presentan disposiciones distintas y la ronda 5 repite la primera con más velocidad.
8. **Cierre.** `npm run lint` y `npm run build` en verde, y una partida completa hasta la ronda 5 revisando que ninguna mecánica nueva rompe el fin de partida ni el guardado de puntuación.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `lib/games/frogger/engine.ts` sigue sin importar nada de `react` ni de `next/*`.
- [ ] La `.player-hud` muestra exactamente Jugador, Puntuación, Vidas y Racha; el número de ronda aparece dentro del canvas.
- [ ] La racha sube un escalón por nicho ocupado, se corta a `x1` al morir y tiene techo `x2`.
- [ ] El multiplicador de racha afecta al premio del nicho y a su bonus de tiempo, pero no a los 10 puntos por fila ni a los 500 de ronda.
- [ ] Cruzar cada múltiplo de 5000 puntos concede una vida, una sola vez por múltiplo, sin pasar de 5 vidas.
- [ ] Las tortugas avisan parpadeando antes de sumergirse; quedarse encima cuando desaparecen cuesta una vida.
- [ ] El morro del cocodrilo nadador mata y su lomo transporta.
- [ ] A partir de la ronda 3 puede aparecer un cocodrilo en un nicho libre, nunca en más de uno a la vez, y saltar ahí cuesta una vida.
- [ ] A partir de la ronda 2 una serpiente patrulla la mediana; a partir de la ronda 5, otra recorre un tronco.
- [ ] La mosca aparece en un nicho libre, dura 6 segundos y da 200 puntos extra si se ocupa ese nicho a tiempo.
- [ ] La rana acompañante se recoge sobre un tronco, se dibuja sobre el jugador, da 200 puntos al entregarla en un nicho y se pierde al morir.
- [ ] Las rondas 1 a 4 usan disposiciones de carril distintas y la 5 reinicia el ciclo con mayor velocidad.
- [ ] El reloj del cruce baja 2 segundos por ronda y nunca por debajo de 16.
- [ ] `emitState()` sigue emitiendo solo ante cambios de `score`, `lives`, `round`, `streak` u `over`, nunca por frame.
- [ ] Al navegar fuera de `/juego/salta-charcos/jugar` no quedan bucles de `requestAnimationFrame` ni listeners vivos.
- [ ] Guardar una puntuación desde el modal sigue insertando en `scores` vía `insertScore` de `lib/scores-client.ts` y apareciendo en `/salon` tras recargar.
- [ ] No cambian `lib/games.ts`, `app/juego/[id]/jugar/page.tsx`, `app/globals.css` ni la fila de `public.games`.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** agrupar todas las mecánicas cortadas en una sola spec de extensión. Comparten propósito (variedad entre rondas) y tocan el mismo archivo; separarlas en seis specs habría multiplicado el trabajo de revisión sin reducir el riesgo.
- **Sí:** "Racha" sustituye a "Ronda" en el HUD. La racha cambia decisiones de juego en tiempo real; la ronda es contexto y puede vivir en el canvas sin perder utilidad.
- **No:** un cuarto `.hud-stat`. El contrato de plataforma fija un máximo de 3 además de "Jugador".
- **Sí:** techo `x2` en el multiplicador de racha. Sin techo, una sola partida afortunada dominaría el leaderboard para siempre.
- **Sí:** activar cocodrilos, serpientes y acompañante por número de ronda y no todas desde la primera. Escalonarlas es lo que convierte la progresión en aprendizaje en vez de en caos inicial.
- **No:** hacer que las tortugas se hundan sin aviso previo. Sin el segundo de parpadeo, la muerte se percibe como aleatoria.
- **Sí:** la rana acompañante se pierde al morir. Si sobreviviera, sería puntuación gratis tras cada muerte.
- **No:** sprites o assets para cocodrilos, serpientes y moscas. Se dibujan con las mismas formas vectoriales del MVP, sin introducir el paso de `public/games/`.
- **No:** sonido para el aviso de tortugas o la mosca, pese a ser el caso donde más se echaría de menos. Sigue vetado en toda la plataforma.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                    | Mitigación                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acumular peligros vuelve la ronda 5 imposible y acorta las partidas en vez de alargarlas.                 | Activación escalonada por ronda y calibración manual en el paso 8 del plan, jugando hasta la ronda 5 antes de cerrar.                                  |
| El campo `streak` en el snapshot dispara emisiones más frecuentes y satura React.                         | `streak` solo cambia al ocupar un nicho o al morir, eventos ya discretos; el diff de `emitState()` se amplía sin añadir emisiones por frame.           |
| Las tortugas sumergibles y el cocodrilo de nicho introducen muertes que el jugador percibe como injustas. | Aviso visual de 1 segundo antes de hundirse y fauces abiertas bien contrastadas en el nicho; criterios de aceptación dedicados a ambos avisos.         |
| Sacar "Ronda" del HUD deja al jugador sin saber por qué acelera todo.                                     | La ronda se dibuja junto a la barra del reloj dentro del canvas, siempre visible.                                                                      |
| Los patrones por ronda rompen el equilibrio calibrado en el MVP y generan huecos imposibles.              | `ROUND_PATTERNS` son 4 tablas estáticas, cada una jugada manualmente antes de darla por buena, con las mismas constantes de velocidad del MVP.         |
| La vida extra por puntuación hace que las partidas largas no terminen nunca.                              | Techo `MAX_LIVES = 5` y reloj decreciente por ronda con piso de 16 segundos: la presión de tiempo sigue creciendo aunque las vidas se recuperen.       |
| El estado de "llevo acompañante" solo vive en el canvas y puede perderse de vista.                        | Se dibuja como silueta encima de la rana, con el mismo brillo que el resto de elementos de puntuación; no entra en el HUD para no exceder los 3 stats. |

---

## Lo que **no** entra en esta spec

- Auth real, contador de `plays`, rate limiting en el `insert` de puntuaciones, realtime.
- Sonido, controles táctiles, `devicePixelRatio`, WASD o cualquier segundo esquema de teclado.
- Tests automatizados e i18n.
- `/frontend-design`, `.cover-*` nuevas, sprites o assets externos.
- Cambios en la ficha de `public.games`, en `lib/games.ts`, en el registro `ENGINES` o en `app/globals.css`.

Cada uno de esos puntos, si llega, va en su propia spec.
