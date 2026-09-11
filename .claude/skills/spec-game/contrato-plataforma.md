# Contrato de integración: cómo entra un juego real a Arcade Vault

Este documento es la referencia técnica que `/spec-game` consulta antes de escribir una
spec. No es texto para copiar dentro de la spec — es el conocimiento acumulado en SPEC 05
(motor de asteroides) y SPEC 06 (leaderboard en Supabase) que hace falta para no repetir
descubrimientos ni pisar las mismas trampas en cada juego nuevo.

---

## a) Puntos de integración, en orden de dependencia

| #   | Archivo                                   | Qué cambia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Migración Supabase (`apply_migration`)    | `insert into public.games (id, title, short, long, cat, cover, color, best, plays, engine) values (...)` con `engine = '<id-del-motor>'`. `best = 0`, `plays` como texto estático ("0" o el valor que decida la spec). **Sin** filas nuevas en `scores`: el leaderboard arranca vacío para este juego hasta que alguien juegue de verdad. No hace falta `generate_typescript_types`: la columna `games.engine` ya es `string \| null` en `lib/supabase/types.ts`, así que cualquier valor de texto nuevo tipa sin tocar el archivo generado. |
| 2   | `lib/games.ts`                            | Ampliar el union `engine?: "asteroids"` de la interfaz `Game` para incluir el nuevo id, **y actualizar los dos casts literales** `(g.engine as "asteroids" \| null) ?? undefined` que aparecen dentro de `getGames()` y de `getGameById()`. Los tres sitios tienen que cambiar juntos o TypeScript no falla pero el tipo miente.                                                                                                                                                                                                             |
| 3   | `lib/games/<juego>/engine.ts`             | Motor nuevo, DOM puro. No importa nada de `react` ni de `next/*`. Ver contrato completo en la sección (b).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | `lib/games/types.ts` (crear si no existe) | `HudStat` y `GameSnapshot`, el snapshot flexible compartido — sección (c). Solo se crea la primera vez que un motor nuevo lo necesita; `lib/games/asteroids/engine.ts` no se toca.                                                                                                                                                                                                                                                                                                                                                           |
| 5   | `app/_components/games/<juego>-game.tsx`  | Wrapper cliente (`"use client"`), calcado de `app/_components/games/asteroids-game.tsx` — ver qué se copia y qué cambia en la sección (e).                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | `app/juego/[id]/jugar/page.tsx`           | Pasar de la cadena de `if` a un registro `engine → componente` — ver sección (d).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7   | `app/globals.css`                         | Tocar solo si el juego necesita una `.cover-*` nueva (entonces pasa por `/frontend-design`, regla de `CLAUDE.md`) o si el canvas no encaja en el `aspect-ratio: 4 / 3` que fija hoy `.game-canvas`. Si el aspect ratio cambia, no se edita la regla global: se decide en la spec si se añade una clase específica o se acepta el recorte por letterboxing.                                                                                                                                                                                   |
| 8   | Verificación                              | `npm run lint` y `npm run build` en verde, como en todas las specs anteriores.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## b) Contrato del motor

Toda spec de motor nuevo debe fijar esta firma, calcada de
`lib/games/asteroids/engine.ts:372-394` y `:677-712`:

```ts
export interface AsteroidsSnapshot {
  score: number;
  lives: number;
  level: number;
  over: boolean;
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

Para un juego nuevo, el nombre cambia (`createTetrisGame`, `TetrisSnapshot`,
`TetrisHandle`) pero la forma y los siguientes invariantes son innegociables:

- **Estado encapsulado.** Todo el estado de una partida vive dentro de la fábrica
  (`ship`, `score`, `level`, temporizadores...). A nivel de módulo solo quedan constantes
  puras (radios, velocidades, puntos) y utilidades sin estado (`wrap`, `dist`, `rand`).
  Esto es lo que permite un `restart()` limpio sin recargar la ruta.
- **`emitState()` con diff.** Se compara el snapshot nuevo contra el último emitido y solo
  se llama a `opts.onState` si algo cambió (`engine.ts:509-527`). Nunca se emite un
  snapshot por frame — saturaría React de renders sin necesidad.
- **`start()` / `destroy()` simétricos.** `start()` ata los listeners de teclado y arranca
  el `requestAnimationFrame`; `destroy()` los quita y cancela el rAF. Sin esta simetría
  queda un bucle fantasma al navegar fuera y volver a entrar.
- **`pause()` / `resume()` sin salto.** `pause()` cancela el rAF; `resume()` pone
  `lastTime = null` para que el siguiente frame no arrastre el `dt` acumulado durante la
  pausa (si no, la partida "salta" al reanudar).
- **`preventDefault` acotado.** Las flechas y `Space` solo bloquean el comportamiento por
  defecto mientras la partida está activa (estados equivalentes a `playing`/`dead`).
  Nunca en pausa ni en `gameover`, para no romper el scroll de la página.
- **Sin HUD de texto en el canvas.** `drawHUD` y `drawOverlay` (marcador, vidas, "GAME
  OVER") se eliminan del port: los pinta la barra `.player-hud` de React a partir del
  snapshot. Se conserva únicamente lo que es efímero y ligado a la escena — en asteroides,
  los temporizadores de power-up dibujados sobre el canvas.
- **Timestep en segundos.** `dt` se calcula en segundos y se clampa (asteroides usa
  `0.05`) para que una pestaña en segundo plano no produzca un salto brusco al volver.
  Si el juego de referencia mueve por frame (`x += vx` sin `dt`), hay que convertir las
  velocidades a unidades por segundo durante el port — si no, el juego corre a distinta
  velocidad según el framerate del monitor.
- **Sin reinicio interno por tecla.** El original puede reiniciar con `Space` u otra tecla
  al llegar a game over; se elimina. El único camino de reinicio es `restart()`, llamado
  por el botón "JUGAR DE NUEVO" del modal de React.

---

## c) Snapshot flexible

Asteroides tiene `score`, `lives`, `level`: encaja limpio en tres `.hud-stat`. Otros
juegos no tienen esa forma — Tetris expone líneas/nivel/combo y no vidas; Arkanoid, en su
versión de referencia, no tiene ni puntos ni vidas. Forzar a todos los motores al mismo
snapshot `{score, lives, level, over}` significa inventar datos que el juego no tiene.

La spec de un juego nuevo (que no sea una variante de asteroides) debe declarar su propio
snapshot sobre esta base común:

```ts
// lib/games/types.ts
export interface HudStat {
  l: string; // etiqueta corta: "Líneas", "Combo"
  v: string; // valor ya formateado como texto: "042", "x3"
}

export interface GameSnapshot {
  score: number;
  over: boolean;
  stats: HudStat[]; // hasta 3 entradas; el wrapper pinta una .hud-stat por cada una
}
```

Cada motor nuevo extiende `GameSnapshot` con los campos crudos que necesite para su propia
lógica interna (por ejemplo `TetrisSnapshot` puede llevar `lines`, `combo`, `level` además
de construir `stats` a partir de ellos). El wrapper de React solo necesita `score`, `over`
y `stats` para pintar el HUD; los campos crudos quedan para quien construya el snapshot.

**Importante:** `lib/games/asteroids/engine.ts` no se toca ni se migra a este tipo cuando
se implemente el primer juego que lo use. Su snapshot `{score, lives, level, over}` sigue
como está — refactorizarlo es una spec aparte, no un efecto colateral de portar el
siguiente juego.

---

## d) Registro `engine → componente`

SPEC 05 dejó pendiente esta decisión a propósito ("no se construye un sistema genérico de
motores; cuando llegue el segundo juego real se decidirá el patrón"). La spec del segundo
motor real es quien debe resolverla, sustituyendo la cadena de `if` de
`app/juego/[id]/jugar/page.tsx` por un registro:

```ts
import { AsteroidsGame } from "@/app/_components/games/asteroids-game";
import { TetrisGame } from "@/app/_components/games/tetris-game";

const ENGINES = {
  asteroids: AsteroidsGame,
  tetris: TetrisGame,
} as const;

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  const Engine = game.engine ? ENGINES[game.engine as keyof typeof ENGINES] : undefined;
  if (Engine) return <Engine game={game} />;

  return <GamePlayer game={game} />;
}
```

La página sigue siendo Server Component; cada wrapper (`AsteroidsGame`, `TetrisGame`, ...)
sigue siendo la única isla `"use client"` de su juego. Si la spec que se está escribiendo
es la primera en portar un segundo motor, este cambio de página va en su plan de
implementación. Si ya existe un registro de una spec anterior, la spec nueva solo añade
una entrada al mapa.

---

## e) Wrapper de React: qué se copia y qué cambia

Base a copiar: `app/_components/games/asteroids-game.tsx` (231 líneas). Se reutiliza casi
literal:

- El marco `.crt` / `.crt-screen` / `.crt-bottom` con el `<canvas className="game-canvas">`
  dentro.
- La barra `.player-hud` con sus `.hud-stat` (Jugador siempre presente; el resto según el
  snapshot del juego).
- Los tres botones de `.hud-actions`: PAUSA/REANUDAR (`.btn yellow`), FIN (`.btn magenta`),
  SALIR (`.btn ghost`, navega a `/juego/<id>`).
- El listener propio del wrapper para `KeyP` y `Escape`, que alternan pausa por el mismo
  camino que el botón.
- El modal `.modal-bd > .modal` completo, con su ciclo `saving / saved / saveError` y los
  tres botones (GUARDAR PUNTUACIÓN, JUGAR DE NUEVO, VOLVER AL VAULT).

Trampas que toda spec de motor nuevo debe señalar explícitamente, porque no son obvias
leyendo solo el código de asteroides:

- **`insertScore` viene de `lib/scores-client.ts`, nunca de `lib/scores.ts`.** El segundo
  importa `lib/supabase/server.ts` (que usa `next/headers`) y rompe el bundle si un
  componente `"use client"` lo llega a importar, aunque sea indirectamente. La separación
  está documentada en la cabecera de ambos archivos — no es un descuido, es deliberada.
- **El nombre de sesión se sincroniza en un efecto, no se lee directo.**
  `useSession().user` empieza `null` y se hidrata desde `localStorage` después del
  montaje; por eso `asteroids-game.tsx` usa `useState("INVITADO")` + un `useEffect` que
  actualiza el nombre cuando `user` cambia, en vez de leerlo una sola vez.
- **El error de guardado no navega ni pierde la partida.** Se pinta reutilizando
  `.toast-saved` con `style={{color: "var(--magenta, #ff2fb3)"}}` en vez de un componente
  de error nuevo, y el botón de guardar queda disponible para reintentar.

---

## f) Checklist de porte desde un `game.js` de referencia

Cuando el origen es una carpeta de `references/started-games/`, estos son los movimientos
que casi siempre hacen falta al convertir el script global en la fábrica del contrato (b):

1. **Encapsular el estado de módulo.** Variables `let` a nivel de archivo (tablero, nave,
   puntuación...) pasan a vivir dentro de `create<Juego>Game`.
2. **Unificar los listeners de teclado.** Varios `window.addEventListener('keydown', ...)`
   sueltos se combinan en un único `handleKeyDown`/`handleKeyUp` con nombre, registrados
   en `start()` y retirados en `destroy()`.
3. **Borrar `drawHUD`/`drawOverlay` (o el HUD en DOM).** Si el original escribe el
   marcador en `<span>` del documento (como Tetris) o lo dibuja en canvas (como
   asteroides/arkanoid), se elimina: lo sustituye la barra `.player-hud` de React
   alimentada por `onState`.
4. **Eliminar el reinicio por tecla u overlay HTML propio.** Pantallas de "Game Over" /
   "Jugar de nuevo" / menús de pausa dibujados por el propio juego se retiran; el único
   camino es `restart()` desde el modal de la plataforma.
5. **Sacar el `localStorage` propio del juego.** Records, mejores puntuaciones, temas o
   skins guardados por el original se eliminan si compiten con el leaderboard de Supabase.
   Si el juego original ofrece variantes visuales (skins, temas) que se quieren conservar,
   la spec decide si entran como prop de React, no como estado interno del motor.
6. **Convertir el timestep a `dt` en segundos** si el original mueve por frame
   (`x += vx` sin multiplicar por tiempo transcurrido).
7. **Mover assets externos a `public/games/<id>/`** con rutas absolutas, si el original
   referencia imágenes o audio con rutas relativas hardcodeadas.
8. **Tipar lo que en JS era implícito.** Objetos sueltos, arrays de niveles, mapas de
   color por carácter: cada uno necesita una interfaz o un tipo en TypeScript estricto.
9. **Resolver los canvas secundarios.** Si el original usa un segundo `<canvas>` (por
   ejemplo, una vista previa de "siguiente pieza"), la spec decide entre pasarlo por
   `opts` al crear el motor, dibujarlo dentro del canvas principal, o exponer el dato
   crudo en el snapshot y dejar que React lo pinte aparte.

---

## g) Criterios de aceptación que toda spec de juego debe incluir

Además de los específicos de cada juego, `/spec-game` inyecta siempre estos invariantes
de plataforma en la sección de criterios de aceptación:

- `npm run build` y `npm run lint` terminan sin errores.
- El motor nuevo (`lib/games/<juego>/engine.ts`) no importa nada de `react` ni de
  `next/*`.
- La ficha existe en `public.games` con su `engine` correspondiente; ninguna otra ficha lo
  lleva por error.
- `/juego/<id>/jugar` renderiza el `<canvas>` jugable dentro del marco `.crt` y responde a
  los controles definidos en la spec.
- Guardar una puntuación desde el modal la hace aparecer en `/salon` (pestaña del juego)
  tras recargar la página.
- Si el `INSERT` de la puntuación falla, se muestra un error inline sin perder la partida
  ni navegar fuera del modal.
- Al navegar fuera de `/juego/<id>/jugar`, no quedan bucles de `requestAnimationFrame` ni
  listeners de teclado vivos (verificable en el rendimiento y en la consola).
- Los juegos que no tienen `engine` siguen mostrando `<GamePlayer>` (el reproductor falso)
  sin cambios.

Y estos riesgos recurrentes, para la tabla de riesgos:

| Riesgo                                                                                | Mitigación esperada                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El bucle o los listeners no se limpian al navegar y queda un bucle fantasma.          | `destroy()` cancela el rAF y quita los listeners; se verifica navegando fuera y volviendo a entrar.                                                                                          |
| `preventDefault` de flechas/`Space` bloquea el scroll del resto de la página.         | Se aplica solo en los estados de partida activa, nunca en pausa ni game over.                                                                                                                |
| El timestep por frame corre distinto según el framerate del monitor.                  | Conversión a `dt` en segundos con clamp, igual que asteroides.                                                                                                                               |
| `params` es una `Promise` y `PageProps` es un global generado en Next 16.             | Revisar la guía de App Router en `node_modules/next/dist/docs/` antes de tocar `app/juego/[id]/jugar/page.tsx`; usar `await params` y el tipo `PageProps<"/juego/[id]/jugar">` ya existente. |
| Assets de audio/imagen con rutas relativas rotas tras mover el código a `lib/games/`. | Mover a `public/games/<id>/` con rutas absolutas antes de portar la lógica que las referencia.                                                                                               |
