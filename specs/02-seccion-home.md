# SPEC 02 — Sección Home como punto de entrada

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-09
> **Objetivo:** Portar `references/templates/home-about/home.jsx` a la ruta raíz `/` como nueva landing de Arcade Vault y mover la Biblioteca de `/` a `/biblioteca`.

---

## 1 — Por qué existe esta spec

SPEC 01 colocó la Biblioteca en `/`. El template `references/templates/home-about/` introduce una landing de marketing (hero, propuesta de valor, preview de juegos, actividad, precios, CTA) que debe ser lo primero que ve un visitante. Esta spec la porta con el mismo criterio que SPEC 01: réplica pixel a pixel del template reutilizando las clases de `app/globals.css`, sin `/frontend-design` y sin lógica nueva.

El efecto colateral es que la Biblioteca deja `/` y pasa a `/biblioteca`, con actualización de todos los enlaces internos que hoy apuntan a `/`.

---

## 2 — Alcance

**Dentro:**

- Nueva ruta `/` (`app/page.tsx`) que renderiza la landing portada de `home.jsx`:
  - Hero: eyebrow "▸ INSERTA UNA MONEDA", título de 3 líneas ("EL ARCADE" / "CLÁSICO ESTÁ" / "DE VUELTA"), subtítulo, dos CTAs (`▶ EXPLORAR JUEGOS` → `/biblioteca`, `✦ CREAR CUENTA` → `/entrar`), indicador "DESLIZA ▼" y siluetas pixeladas flotantes (`FloatingSilhouettes`, 8 SVG decorativos).
  - Sección "// 01 ¿POR QUÉ ARCADE VAULT?": grid de 4 `feature-card` (cyan / yellow / magenta / green) con icono SVG pixel (`FeatureIcon`: GAMEPAD, FREE, TROPHY, ROCKET), título y descripción.
  - Sección "// 02 JUEGOS DISPONIBLES AHORA": `mini-rail` con `GAMES.slice(0, 6)` (`MiniCard` → `/juego/[id]`) y botón `VER TODOS LOS JUEGOS →` → `/biblioteca`.
  - Banda de estadísticas (`home-stats`): 3 bloques estáticos ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING").
  - Sección "// 03 ACTIVIDAD EN VIVO": dos `activity-card` con datos hardcodeados del template — ticker de 7 "ÚLTIMAS PUNTUACIONES" y lista de 5 "TOP JUGADORES · HOY" con botón `VER SALÓN →` → `/salon`.
  - Sección "// 04 PRECIOS": `price-card` "JUGADOR VAULT · $0 / SIEMPRE" con lista de 6 ventajas, sello "FREE PLAY", botón `EMPEZAR GRATIS →` → `/entrar`, y `pricing-faq` con 3 preguntas.
  - Sección final (`home-final`): "¿LISTO PARA JUGAR?" + botón `INSERTAR MONEDA →` → `/biblioteca`.
  - Animación de entrada por scroll: las secciones con clase `reveal` reciben la clase `in` vía `IntersectionObserver` (portado de `useReveal`).
- Biblioteca movida a `/biblioteca` (`app/biblioteca/page.tsx`): mismo contenido que la actual `app/page.tsx` de SPEC 01 (sección `av-hero` + `<LibraryBrowser>`), sin cambios visuales.
- `app/_components/nav.tsx` actualizado: nuevo enlace "Inicio" → `/` (activo solo en `/`), "Biblioteca" → `/biblioteca` (activo en `/biblioteca` y `/juego/*`), el logo sigue apuntando a `/`. Mismo cambio en el panel móvil.
- Actualización de todos los enlaces internos que hoy van a `/` y deben ir a `/biblioteca`:
  - `app/juego/[id]/page.tsx` ("VOLVER AL VAULT").
  - `app/juego/[id]/not-found.tsx` ("VOLVER A LA BIBLIOTECA").
  - `app/_components/game-player.tsx` ("VOLVER AL VAULT" del modal de fin de juego).
  - `app/_components/hall-of-fame.tsx` ("VOLVER A LA BIBLIOTECA").
  - `app/_components/auth-form.tsx` (`router.push` tras iniciar sesión y tras "jugar como invitado").
- Estilos de la Home portados a `app/globals.css` desde `references/templates/home-about/styles.css` (bloques `HOME PAGE`, `ACTIVITY`, `PRICING` y keyframes `float`, `bounce`, `pulse-led`, `tickin`).
- Modelo Server shell + isla Client: `app/page.tsx` es Server Component; solo el wrapper de `reveal` lleva `"use client"`.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- La página "Acerca de" / Contacto (`references/templates/home-about/about.jsx`) y su enlace en el nav. Va en su propia spec.
- Los estilos de `styles.css` que no usa la Home: `GAMEPAD` (`.gp*`), `.about-*`, `.terminal-success`, `.spinner`, `.gp-themer`, keyframes `shake` / `pxblink` / `scorepop` / `spinpix`.
- Cablear "Actividad en vivo", la banda de estadísticas o "Precios" a datos reales o a `lib/leaderboard.ts`: se portan los arrays literales del template.
- La insignia `live-led` "EN VIVO" animada del `ac-head`: `home.jsx` no la renderiza (solo el título y, en la segunda tarjeta, el botón `VER SALÓN →`).
- `redirect()` de compatibilidad para la URL `/` antigua: no hay historial ni enlaces externos que preservar en un MVP.
- Autenticación real, backend, juegos reales, tests, i18n, rediseño visual (igual que SPEC 01).

---

## 3 — Modelo de datos

Esta feature no introduce estructuras de datos nuevas. Reutiliza `GAMES` de `lib/games.ts` (SPEC 01) para el `mini-rail`. Los datos de las secciones "Actividad en vivo", "Estadísticas" y "Precios" son arrays y literales estáticos que se copian tal cual desde `home.jsx` y viven dentro del componente de la Home, no en `lib/`.

Convenciones:

- Ruta de la Biblioteca: `/biblioteca`. La raíz `/` es la Home.
- El logo del nav enlaza a `/` (Home); "Inicio" a `/`; "Biblioteca" a `/biblioteca`.
- Los `className` son exactamente los de `app/globals.css` tras portar los bloques nuevos. No se escribe CSS a mano fuera de ese porte.
- Los componentes SVG decorativos (`FloatingSilhouettes`, `FeatureIcon`, `MiniCard`) se portan como funciones del módulo de la Home; el global `window.Home` no se porta.

---

## 4 — Plan de implementación

1. **Estilos de la Home.** Copiar a `app/globals.css`, desde `references/templates/home-about/styles.css`, los bloques `HOME PAGE` (`.home`, `.home-hero`, `.home-title`, `.home-silos` / `.silo`, `.home-section`, `.section-head`, `.feature-*`, `.mini-rail` / `.mini-card`, `.home-stats` / `.stat-*`, `.home-final` / `.final-*`, `.reveal`), `ACTIVITY` (`.activity-grid`, `.ac-head`, `.ac-title`, `.lb-link`, `.ticker`, `.tick-row`, `.tk-*`, `.top-list`, `.top-row`, `.tp-*`) y `PRICING` (`.pricing-grid`, `.price-card`, `.pc-*`, `.pricing-faq`, `.faq-*`), más los keyframes `float`, `bounce`, `pulse-led` y `tickin`. No copiar `.fade-in` / `@keyframes fadeIn` / `.slide-in` (ya existen en `app/globals.css`). Verificación: `npm run build` sigue en verde; ninguna regla nueva se usa todavía.
2. **Ruta `/biblioteca`.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (sección `av-hero` + `<LibraryBrowser games={GAMES} cats={CATS} />`), ajustando el import de `LibraryBrowser` a la nueva ubicación (`../_components/library-browser`). No tocar `app/page.tsx` todavía. Verificación: `/biblioteca` muestra el hero y el grid; `/` sigue mostrando la Biblioteca antigua.
3. **Reapuntar enlaces internos a `/biblioteca`.** Cambiar `href="/"` → `href="/biblioteca"` en `app/juego/[id]/page.tsx`, `app/juego/[id]/not-found.tsx` y `app/_components/hall-of-fame.tsx`; `router.push("/")` → `router.push("/biblioteca")` en `app/_components/game-player.tsx` y en las dos llamadas de `app/_components/auth-form.tsx`. Verificación: desde el detalle, el reproductor, el salón y el login se navega a `/biblioteca`.
4. **Wrapper de reveal.** Crear `app/_components/reveal.tsx` (`"use client"`): componente que envuelve a sus `children` (acepta `className` para poder emitir `home-section reveal`, `home-stats reveal`, `home-final reveal`), registra un `IntersectionObserver` con `threshold: 0.12` en un `useEffect`, añade la clase `in` al entrar en viewport y hace `unobserve` del elemento; `disconnect()` en el cleanup. Portado de `useReveal` de `home.jsx`. Verificación: importable sin romper el render en servidor.
5. **Página Home.** Reemplazar `app/page.tsx` por un Server Component que porta `home.jsx`: helpers `FloatingSilhouettes` y `FeatureIcon` como funciones del módulo; hero con las 2 CTAs como `<Link>` a `/biblioteca` y `/entrar`; secciones "01–04" y final usando `<Reveal>` para la animación de scroll; `mini-rail` sobre `GAMES.slice(0, 6)` con `<Link href={`/juego/${g.id}`}>`; arrays estáticos de "Actividad en vivo", estadísticas y precios copiados del template; `VER SALÓN →` → `/salon`. Verificación: `/` muestra la landing completa y ya no el buscador ni el grid de la Biblioteca.
6. **Navbar.** Modificar `app/_components/nav.tsx`: añadir enlace "Inicio" → `/` antes de "Biblioteca"; `inicioActive = pathname === "/"`; `libraryActive = pathname.startsWith("/biblioteca") || pathname.startsWith("/juego")`; cambiar el `href` de "Biblioteca" a `/biblioteca`; el logo mantiene `href="/"`. Replicar los dos enlaces en el panel móvil. Verificación: en `/` está activo "Inicio"; en `/biblioteca` y `/juego/*` está activo "Biblioteca".
7. **Cierre.** Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde. Repasar que ningún enlace quede apuntando al `/` antiguo como "volver a la biblioteca".

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `/` renderiza el hero de la Home: eyebrow "▸ INSERTA UNA MONEDA", título en 3 líneas "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA", subtítulo y las siluetas pixeladas flotantes.
- [ ] El hero muestra dos botones: `▶ EXPLORAR JUEGOS` navega a `/biblioteca` y `✦ CREAR CUENTA` a `/entrar`.
- [ ] Al hacer scroll, las secciones "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", "ACTIVIDAD EN VIVO" y "PRECIOS" aparecen con la transición `reveal` (de opacidad 0 y desplazadas a visibles).
- [ ] "¿POR QUÉ ARCADE VAULT?" muestra 4 tarjetas (JUEGOS CLÁSICOS, 100% GRATIS, LADDER BOARDS, SIEMPRE CRECIENDO) con icono pixel y color propio.
- [ ] "JUEGOS DISPONIBLES AHORA" muestra 6 `mini-card` con los primeros 6 juegos de `GAMES`; hacer clic en una navega a `/juego/<id>`; `VER TODOS LOS JUEGOS →` navega a `/biblioteca`.
- [ ] La banda de estadísticas muestra "12+ JUEGOS", "MILES DE PARTIDAS" y "GLOBAL RANKING".
- [ ] "ACTIVIDAD EN VIVO" muestra el ticker con 7 filas de últimas puntuaciones y la lista con 5 top jugadores; `VER SALÓN →` navega a `/salon`.
- [ ] "PRECIOS" muestra la tarjeta "JUGADOR VAULT" con "$0 / SIEMPRE", 6 ítems de la lista, el sello "FREE PLAY" y 3 preguntas en el FAQ; `EMPEZAR GRATIS →` navega a `/entrar`.
- [ ] La sección final muestra "¿LISTO PARA JUGAR?" y el botón `INSERTAR MONEDA →` navega a `/biblioteca`.
- [ ] `/biblioteca` muestra el hero "ARCADE VAULT" y el grid de 8 juegos con buscador y chips, idéntico a como estaba en `/` antes de esta spec.
- [ ] `/` ya no muestra el buscador ni el grid de la Biblioteca.
- [ ] La navbar muestra "Inicio" y "Biblioteca" como enlaces separados; "Inicio" está activo en `/` y "Biblioteca" en `/biblioteca` y en `/juego/*`.
- [ ] El logo de la navbar navega a `/` (Home).
- [ ] Desde `/juego/<id>` el botón "VOLVER AL VAULT" navega a `/biblioteca`; desde `/juego/<id-inexistente>` el enlace de la pantalla not-found navega a `/biblioteca`.
- [ ] En el modal de fin de juego del reproductor, "VOLVER AL VAULT" navega a `/biblioteca`.
- [ ] En `/salon`, "VOLVER A LA BIBLIOTECA" navega a `/biblioteca`.
- [ ] Tras iniciar sesión o pulsar "JUGAR COMO INVITADO" en `/entrar`, la redirección lleva a `/biblioteca`.
- [ ] El footer sigue apareciendo en todas las pantallas, incluida la Home.
- [ ] El aspecto de `/` coincide con `references/templates/home-about/home.jsx` (mismos `className`, mismo orden de secciones).

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** la Home ocupa la raíz `/` y la Biblioteca pasa a `/biblioteca`. El encargo pide que la Home sea "el punto de entrada de la aplicación".
- **No:** dejar la Biblioteca en `/` y montar la Home en `/home` o `/inicio`. Contradice el objetivo del encargo.
- **Sí:** slug `/biblioteca` en español. Coherente con `/entrar` y `/salon` de SPEC 01.
- **No:** `/juegos` o `/vault`. `/juegos` colisiona conceptualmente con `/juego/[id]`; `/vault` rompe la coherencia de slugs en español.
- **Sí:** portar "Actividad en vivo", estadísticas y "Precios" con los arrays literales del template, dentro del componente de la Home. Fiel al prototipo, mismo criterio que SPEC 01 con las demás pantallas.
- **No:** generar el ticker y el top de jugadores con `seededScores()` / `PLAYERS`. Añade lógica no pedida y desvía del template.
- **No:** usar `/frontend-design`. La Home ya está diseñada en `home.jsx` + `styles.css`; se replica reutilizando clases, igual que decidió SPEC 01.
- **Sí:** `app/page.tsx` como Server Component con una única isla Client (`<Reveal>`) para el `IntersectionObserver`. Alineado con el modelo de SPEC 01.
- **No:** marcar toda la Home como `"use client"`. Portaría más rápido pero renuncia al render en servidor de una landing casi estática.
- **Sí:** actualizar en esta spec todos los enlaces internos que van a `/` para que apunten a `/biblioteca`. Si no, "volver a la biblioteca" llevaría a la Home.
- **No:** añadir un `redirect()` de compatibilidad del `/` antiguo. No hay enlaces externos ni historial que preservar en un MVP.
- **Sí:** dejar "Acerca de" (`about.jsx`) fuera de esta spec pese a estar en la carpeta `home-about` y en el nav del template. Es una pantalla independiente con su propio formulario; merece su spec.
- **Sí:** portar solo los bloques de `styles.css` que usa la Home. El resto (`GAMEPAD`, `about-*`, `spinner`, …) se portará cuando llegue la pantalla que lo necesite.

---

## 7 — Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Mover la Biblioteca de `/` a `/biblioteca` deja enlaces "volver" apuntando a la Home. | El paso 3 del plan reapunta explícitamente los seis enlaces internos y hay criterios de aceptación que verifican cada uno. |
| `IntersectionObserver` ejecutándose en SSR o antes de montar lanza. | El observer vive en `app/_components/reveal.tsx` (`"use client"`), dentro de un `useEffect`, con `disconnect()` en el cleanup; nunca corre en el render de servidor. |
| Copiar bloques de `styles.css` puede duplicar reglas ya presentes en `app/globals.css` (`.fade-in`, `@keyframes fadeIn`, `.slide-in`). | El paso 1 lista exactamente qué bloques y keyframes portar y cuáles omitir por existir ya. |
| Typed routes rechaza `href="/biblioteca"` si la ruta aún no existe al type-checkear. | Crear `app/biblioteca/page.tsx` (paso 2) antes de reapuntar los enlaces (paso 3) y antes de tocar el nav (paso 6). |
| El template usa `navigate({ name: "..." })`; portarlo mal deja botones inertes. | Cada CTA se porta a `<Link href>` o `router.push` con la ruta real correspondiente; los criterios de aceptación verifican el destino de cada botón. |

---

## Lo que **no** entra en esta spec

- La página "Acerca de" / Contacto y su enlace en el nav.
- Cablear las secciones de la Home a datos reales o a `lib/`.
- Estilos de `styles.css` ajenos a la Home (`GAMEPAD`, `about-*`, `spinner`, `gp-themer`).
- `redirect()` de compatibilidad para la URL `/` antigua.
- Autenticación real, backend, juegos reales, tests automatizados, i18n y rediseño visual.

Cada uno de esos puntos, si llega, va en su propia spec.
