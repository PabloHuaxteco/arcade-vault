# SPEC 01 — MVP visual de las pantallas de Arcade Vault

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-09-08
> **Objetivo:** Portar las cinco pantallas de `references/templates/` a rutas reales de Next.js App Router, solo la capa visual, sin implementar ningún juego.

---

## 1 — Por qué existe esta spec

Las plantillas de `references/templates/` son una SPA de React 18 servida con Babel en el navegador y un router propio basado en el hash (`{ name: "biblioteca" }`). El proyecto real es Next.js 16 con App Router, React 19 y Tailwind v4. Esta spec traduce ese prototipo a la arquitectura del proyecto sin rehacer el diseño: el tema ya está portado en `app/globals.css` y las fuentes y los fondos ya están montados en `app/layout.tsx`.

La decisión no obvia es **no usar `/frontend-design`**: no se diseña interfaz nueva, se replica una existente pixel a pixel reutilizando las clases CSS ya portadas.

---

## 2 — Alcance

**Dentro:**

- Cinco pantallas como rutas reales de App Router:
  - `/` → Biblioteca (hero, buscador, chips de categoría, grid de tarjetas).
  - `/juego/[id]` → Detalle del juego (portada, tags, descripción, tira de estadísticas, tabla de mejores puntuaciones lateral).
  - `/juego/[id]/jugar` → Reproductor (HUD, pantalla CRT falsa, overlay de pausa, modal de fin de juego).
  - `/entrar` → Auth (tabs iniciar sesión / crear cuenta, campos, "jugar como invitado", botones sociales).
  - `/salon` → Salón de la Fama (tabs por juego, podio, tabla de rangos, fila "tú" si hay sesión).
- Navbar común (`Nav`) con enlaces Biblioteca / Salón de la Fama, contador de créditos decorativo, botón de sesión y panel móvil.
- Footer común con el texto `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`.
- Datos mock portados a TypeScript tipado en `lib/` (juegos, categorías, generador de puntuaciones sembrado, lista de jugadores).
- Persistencia en `localStorage` equivalente a la del template: sesión falsa (`av_user`) y guardado de puntuaciones (`av_scores`).
- Interactividad simulada del template: tilt de las tarjetas, filtro de búsqueda y categoría, tabs, panel móvil, y el marcador/nivel del Reproductor que sube solo con `setInterval`.
- Modelo Server shells + islas Client: las `page.tsx` son Server Components y solo llevan `"use client"` los componentes interactivos.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Lógica de cualquier juego real (colisiones, input, bucle de render de un juego).
- Autenticación real, backend, API o base de datos. El login sigue siendo falso: cualquier envío entra.
- Persistencia de puntuaciones más allá de `localStorage` (ranking global real, sincronización).
- Tests automatizados (no hay runner configurado).
- Internacionalización: la UI queda en español, como el template.
- Cambios de diseño, nuevos componentes visuales o uso de `/frontend-design`.
- Optimización de imágenes / assets: las portadas son CSS puro, no hay imágenes.

---

## 3 — Modelo de datos

Se portan las estructuras de `references/templates/data.jsx` a TypeScript. No hay datos nuevos respecto al template; se les añaden tipos.

### `lib/games.ts`

```ts
export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;          // "bloque-buster"
  title: string;       // "BLOQUE BUSTER"
  short: string;       // descripción corta para la tarjeta
  long: string;        // descripción larga para el detalle
  cat: GameCategory;
  cover: string;       // clase CSS de portada: "cover-bricks", "cover-tetro", ...
  color: GameColor;
  best: number;        // mejor puntuación global
  plays: string;       // "12.4K"
}

export const GAMES: Game[];                 // los 8 juegos del template
export const CATS: readonly string[];       // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
```

### `lib/leaderboard.ts`

```ts
export interface ScoreRow {
  rank: number;
  name: string;    // "PX_KAI"
  score: number;
  date: string;    // "07/03/2026"
}

export const PLAYERS: string[];
export function seededScores(seed: number, count?: number): ScoreRow[]; // determinista, portado tal cual
```

### `lib/storage.ts`

```ts
export interface StoredUser {
  name: string;      // en mayúsculas, máx. 10 caracteres
}

export interface StoredScore {
  game: string;      // Game["id"]
  score: number;
  name: string;
  at: number;        // Date.now()
}

// Claves de localStorage: "av_user", "av_scores".
// Todas las funciones son seguras en SSR (comprueban `typeof window`).
export function readUser(): StoredUser | null;
export function writeUser(user: StoredUser): void;
export function clearUser(): void;
export function readScores(): StoredScore[];
export function appendScore(entry: Omit<StoredScore, "at">): void;
```

Convenciones:

- Slugs de ruta en español: `/juego/[id]`, `/juego/[id]/jugar`, `/entrar`, `/salon`. La Biblioteca es la raíz `/`.
- El `id` de la URL del detalle y del reproductor es el `Game["id"]`.
- Los `className` de los componentes son exactamente los de `app/globals.css` (`.card`, `.av-grid`, `.leaderboard`, `.crt`, …). No se escribe CSS nuevo.

---

## 4 — Plan de implementación

1. **Datos mock tipados.** Crear `lib/games.ts` (`Game`, `GameColor`, `GameCategory`, `GAMES`, `CATS`) y `lib/leaderboard.ts` (`ScoreRow`, `PLAYERS`, `seededScores`) portando `data.jsx` sin cambios de valores. Verificación: `npx tsc --noEmit` compila.
2. **Helpers de persistencia.** Crear `lib/storage.ts` con las funciones y tipos del modelo de datos, cada una protegida con `typeof window === "undefined"`. Verificación: importable desde un Client Component sin romper el render en servidor.
3. **Contexto de sesión.** Crear `app/_components/session-provider.tsx` (`"use client"`): provee `{ user, signIn(name), signOut() }`, hidrata `user` desde `readUser()` en un `useEffect`, y persiste con `writeUser` / `clearUser`. Exporta un hook `useSession()`.
4. **Footer.** Crear `app/_components/site-footer.tsx` (Server Component) con el `<footer>` y el texto del template.
5. **Navbar.** Crear `app/_components/nav.tsx` (`"use client"`): logo, enlaces Biblioteca / Salón de la Fama con estado activo vía `usePathname()`, contador de créditos, botón que muestra el nombre de `useSession()` o enlaza a `/entrar`, y panel móvil con backdrop. Los enlaces usan `<Link>` con rutas tipadas.
6. **Layout.** Modificar `app/layout.tsx`: envolver `children` en `<SessionProvider>`, y dentro de `.av-root` montar `<Nav />`, `<main className="av-main">{children}</main>` y `<SiteFooter />`. Quitar cualquier resto del scaffold.
7. **Biblioteca — grid y tarjetas.** Crear `app/_components/game-card.tsx` (`"use client"`, tilt con `ref` y `onMouseMove`) y `app/_components/library-browser.tsx` (`"use client"`, estado de búsqueda `q` y categoría `cat`, `useMemo` para filtrar, grid y estado vacío). Navega a `/juego/[id]` al seleccionar.
8. **Biblioteca — página.** Reemplazar `app/page.tsx` por un Server Component que renderiza la sección `av-hero` y `<LibraryBrowser games={GAMES} cats={CATS} />`. Verificación: `/` muestra el hero y las 8 tarjetas, el buscador y los chips filtran.
9. **Detalle — página.** Crear `app/juego/[id]/page.tsx` (Server Component, `params` asíncrono): busca el juego en `GAMES`, llama `notFound()` si no existe; renderiza portada, tags, descripción larga, `stat-strip` y acciones (`▶ JUGAR AHORA` → `/juego/[id]/jugar`, `VOLVER AL VAULT` → `/`). Aside con `<Leaderboard rows={seededScores(id.length * 17 + 3, 10)} />` (componente Server en `app/_components/leaderboard.tsx`). Crear `app/juego/[id]/not-found.tsx` mínimo con enlace a `/`.
10. **Reproductor.** Crear `app/juego/[id]/jugar/page.tsx` (Server Component: resuelve el juego o `notFound()`) que monta `app/_components/game-player.tsx` (`"use client"`): HUD con jugador (de `useSession()`), marcador y nivel que suben con `setInterval` cuando no está en pausa ni terminado, botones PAUSA / FIN / SALIR, arena `.crt` falsa, overlay de pausa y modal de fin de juego que guarda con `appendScore` y muestra el toast. `JUGAR DE NUEVO` reinicia el estado; `VOLVER AL VAULT` va a `/`.
11. **Auth.** Crear `app/entrar/page.tsx` (Server Component) que monta `app/_components/auth-form.tsx` (`"use client"`): tabs iniciar / crear (campo email solo en "crear"), campos usuario y contraseña, botón principal, `JUGAR COMO INVITADO`, divisor y botones sociales inertes. Al enviar: `signIn(usuario || "PLAYER1")` y `router.push("/")`. "Invitado": `signOut()` y `router.push("/")`.
12. **Salón de la Fama.** Crear `app/salon/page.tsx` (Server Component) que monta `app/_components/hall-of-fame.tsx` (`"use client"`): tabs por juego (`GAMES`), podio con los 3 primeros de `seededScores(tab.length * 23 + 7, 12)`, tabla de 12 filas con animación escalonada, y bloque "tú" (rango y puntuación derivados) solo si hay `user`. Botón `VOLVER A LA BIBLIOTECA` → `/`.
13. **Cierre.** Eliminar assets del scaffold que queden sin usar (`app` ya no importa `next/image`; revisar `public/next.svg`, `public/vercel.svg`). Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `/` muestra el hero "ARCADE VAULT", el buscador, los 5 chips de categoría y 8 tarjetas de juego.
- [ ] Escribir en el buscador filtra las tarjetas por título; seleccionar un chip filtra por categoría; sin resultados aparece el bloque "NO HAY RESULTADOS".
- [ ] Pasar el ratón sobre una tarjeta aplica el efecto de inclinación (tilt) y quitarlo lo resetea.
- [ ] Hacer clic en una tarjeta o en su botón `JUGAR` navega a `/juego/<id>`.
- [ ] `/juego/bloque-buster` muestra portada, tags, descripción larga, la tira de 3 estadísticas y la tabla lateral "MEJORES PUNTUACIONES" con 10 filas.
- [ ] `/juego/<id-inexistente>` renderiza la pantalla `not-found` con enlace a `/`.
- [ ] En el detalle, `▶ JUGAR AHORA` navega a `/juego/<id>/jugar` y `VOLVER AL VAULT` a `/`.
- [ ] En `/juego/<id>/jugar` el marcador y el nivel aumentan solos; `PAUSA` los detiene y muestra el overlay "EN PAUSA"; `REANUDAR` los reanuda.
- [ ] `FIN` abre el modal "FIN DEL JUEGO" con la puntuación final; `GUARDAR PUNTUACIÓN` añade una entrada a `localStorage["av_scores"]` y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] `/entrar` muestra las tabs; en "CREAR CUENTA" aparece el campo de email; enviar el formulario guarda `localStorage["av_user"]` y redirige a `/`.
- [ ] `JUGAR COMO INVITADO` limpia `localStorage["av_user"]` y redirige a `/`.
- [ ] Tras iniciar sesión, la navbar muestra el nombre del usuario en mayúsculas (máx. 10 caracteres) en lugar del botón "Iniciar Sesión".
- [ ] `/salon` muestra las tabs por juego, el podio de 3, la tabla de 12 filas y, con sesión iniciada, la fila "▸ TU MEJOR MARCA EN …".
- [ ] La navbar es sticky, los enlaces marcan el estado activo según la ruta y el panel móvil se abre y cierra por debajo de 840px.
- [ ] El footer aparece en las cinco pantallas con el texto y la versión del template.
- [ ] El aspecto de cada pantalla coincide con la plantilla equivalente de `references/templates/` (mismos `className`, mismo layout).

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** rutas reales de App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/entrar`, `/salon`). Es lo idiomático en Next 16 y aprovecha typed routes; el hash-router del template era una limitación del prototipo servido con Babel.
- **No:** replicar el hash-router en una única `page.tsx` client-side. Más fiel al template pero desaprovecha el App Router y complica el SEO y la navegación.
- **Sí:** reutilizar las clases ya portadas en `app/globals.css`. `CLAUDE.md` pide que la app "renderice exactamente como las plantillas"; el CSS ya está completo, solo falta emitir el markup.
- **No:** reconstruir las pantallas con utilidades Tailwind v4. Más trabajo y riesgo de desviarse del diseño original sin ningún beneficio para un MVP visual.
- **Sí:** Server Components para las `page.tsx` e islas Client (`"use client"`) solo para lo interactivo (Nav, buscador, tarjetas, Auth, HUD, tabs del Salón). Alineado con App Router.
- **No:** marcar cada pantalla entera como Client Component. Portaría 1:1 más rápido pero renuncia al renderizado en servidor.
- **Sí:** mantener `localStorage` (`av_user`, `av_scores`) y el marcador simulado del Reproductor. Es comportamiento visual que el template ya trae y da vida a las pantallas.
- **No:** dejar todo estático sin `localStorage` ni temporizadores. Perdería el estado de sesión visible en la navbar y el modal de guardado de puntuación.
- **Sí:** slugs de ruta en español (`/entrar`, `/salon`, `/juego`). Coherente con el idioma de la UI y del proyecto.
- **No:** usar `/frontend-design`. No se diseña interfaz nueva; se replica una existente.
- **Sí:** el login sigue siendo falso (cualquier envío entra), igual que en `auth.jsx`. Autenticación real es otra spec.
- **Sí:** contexto de sesión en un Client Provider (`SessionProvider`) montado en el layout, porque Nav, Auth, Reproductor y Salón necesitan el mismo `user` y con rutas separadas ya no hay un `App` que lo pase por props.

---

## 7 — Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Leer `localStorage` durante el render de servidor lanza o provoca hydration mismatch. | Todos los accesos en `lib/storage.ts` comprueban `typeof window`; el `SessionProvider` hidrata `user` en un `useEffect`, nunca en el render inicial. |
| `localStorage` deshabilitado (modo privado) hace fallar el guardado. | Envolver lecturas y escrituras en `try/catch`; la UI sigue funcionando sin persistir, como en el template. |
| Typed routes rechaza `href` construidos con plantilla para segmentos dinámicos (`/juego/${id}/jugar`). | Usar el patrón admitido por Next 16 para rutas dinámicas en `<Link>`; si el build se queja, tipar el `href` con el helper `Route` generado. |
| Patrones del template incompatibles con módulos ES (`window.Library = …`, `const { useState } = React`, `<script type="text/babel">`). | Reescribir cada componente como módulo con `import`/`export`; los globales de `window` no se portan. |
| `params` en Next 16 es asíncrono en las páginas dinámicas. | Las `page.tsx` de `/juego/[id]` y `/juego/[id]/jugar` reciben `params` como `Promise` y hacen `await` según la guía en `node_modules/next/dist/docs/`. |

---

## Lo que **no** entra en esta spec

- Ningún juego real ni su lógica.
- Autenticación real, backend, API o base de datos.
- Ranking global real o sincronización de puntuaciones fuera de `localStorage`.
- Tests automatizados.
- Internacionalización.
- Rediseño visual o componentes nuevos.

Cada uno de esos puntos, si llega, va en su propia spec.
