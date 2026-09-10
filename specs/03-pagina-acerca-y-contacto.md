# SPEC 03 — Página Acerca de y formulario de contacto con Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-09-09
> **Objetivo:** Portar `references/templates/home-about/about.jsx` a la ruta `/acerca` y hacer que su formulario de contacto envíe un correo real mediante Resend a través de una Server Action.

---

## 1 — Por qué existe esta spec

SPEC 02 portó `home.jsx` a `/` y dejó explícitamente fuera "la página Acerca de / Contacto (`about.jsx`) y su enlace en el nav", junto con los estilos `.about-*`, `.terminal-success` y los keyframes `shake` / `pxblink`. Esta spec recoge esa deuda.

A diferencia de SPEC 01 y SPEC 02, esta pantalla no es solo capa visual: el formulario de contacto del template solo simula el envío (`setSent(form.name)` y una animación de terminal). Aquí el envío es real: una Server Action llama a Resend con la API key guardada en variables de entorno. El resto de la pantalla se replica pixel a pixel reutilizando clases CSS, con el mismo criterio que las dos specs anteriores (sin `/frontend-design`).

---

## 2 — Alcance

**Dentro:**

- Nueva ruta `/acerca` (`app/acerca/page.tsx`, Server Component) que porta `about.jsx`:
  - `about-hero`: kicker "▸ ACERCA DE" (`pixel neon-yellow`), título `about-title` "ACERCA DE ARCADE VAULT", párrafo `about-mission` con el texto literal del template, y `highlight-row` con 3 `highlight` (magenta / cyan / green), cada uno con su `HighlightIcon` SVG pixel (`HEART`, `BROWSER`, `PLANT`), texto `hl-text` y `transitionDelay` escalonado (`i * 80ms`).
  - `about-divider` (envuelto en `<Reveal>`): dos `div-bar` y `div-pixels` con 24 `<span>` de `animationDelay` escalonado (`i * 80ms`).
  - `about-contact` (envuelto en `<Reveal>`): `contact-grid` con `contact-intro` (kicker "▸ CONTACTO" `pixel neon-cyan`, título `contact-title` "CONTÁCTANOS", `contact-sub`, y `contact-tips` con 3 `tip`: "RESPUESTA EN 24-48H", "SUGERENCIAS BIENVENIDAS", "SIN SPAM, JAMÁS") y el componente cliente `<ContactForm />`.
- `app/_components/contact-form.tsx` (`"use client"`): el `<form className="contact-form">` portado, gestionado con `useActionState` sobre la Server Action.
  - Campos: `NOMBRE` y `CORREO ELECTRÓNICO` con la estructura `.field` (ya existente), `MENSAJE` como `<textarea rows="5">`, con los mismos `placeholder` del template ("px_kai", "jugador@vault.gg", "Cuéntanos qué tienes en mente…").
  - Campo honeypot oculto (`<input name="company" tabIndex={-1} autoComplete="off">` con `display:none` vía atributo `hidden` o estilo inline) que no ve el usuario.
  - Botón `▶ ENVIAR MENSAJE` (`btn xl press`, `width:100%`). Mientras `pending`: texto `ENVIANDO…` y `disabled`.
  - Estado de éxito (`state.ok`): se renderiza el bloque `terminal-success` del template (barra `term-bar` con 3 `dot`, `term-title` "VAULT-OS // TERMINAL", `term-body` con las líneas `[OK] …` y `> MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}.` + `caret`), con botón `ENVIAR OTRO MENSAJE` que limpia el formulario y vuelve al estado inicial.
  - Estado de error de validación en cliente (algún campo vacío): se aplica la clase `shake` durante 400 ms y no se envía, igual que el template.
  - Estado de error del servidor (`state.error`): mensaje inline debajo del botón con la clase nueva `contact-error`; el formulario conserva lo escrito y permite reintentar.
- `app/acerca/actions.ts` (`"use server"`): Server Action `sendContactMessage(prevState, formData)`.
  - Lee `name`, `email`, `msg`, `company` (honeypot) de `formData`.
  - Si `company` no está vacío: devuelve `{ ok: true }` sin enviar nada (bot descartado en silencio).
  - Valida en servidor: los 3 campos no vacíos (tras `trim`) y que `email` cumpla un formato básico (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Si falla: `{ ok: false, error: "Revisa los campos: nombre, correo válido y mensaje son obligatorios." }`.
  - Envía con Resend: `from` fijo `"Arcade Vault <onboarding@resend.dev>"`, `to` = `process.env.CONTACT_TO`, `reply_to` = email del visitante, `subject` = `` `Arcade Vault · Nuevo mensaje de ${name}` ``, cuerpo en texto plano con nombre, correo y mensaje.
  - Si Resend responde error o falta `RESEND_API_KEY` / `CONTACT_TO`: `{ ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo en un momento." }` y `console.error` del detalle.
  - Éxito: `{ ok: true, name }`.
- `app/_components/nav.tsx` actualizado: enlace "Acerca de" → `/acerca` después de "Salón de la Fama", en `.links` y en el panel móvil; `acercaActive = pathname === "/acerca"`.
- Estilos portados a `app/globals.css` desde `references/templates/home-about/styles.css`, bloque `ABOUT PAGE` y siguientes: `.about`, `.about-hero`, `.about-hero .kicker`, `.about-title`, `.about-mission`, `.highlight-row` (+ media query), `.highlight` (+ `.cyan` / `.magenta` / `.green` / `:hover`), `.highlight .hl-icon`, `.highlight .hl-text`, `.about-divider`, `.div-bar`, `.div-pixels`, `.div-pixels span` (+ `:nth-child`), `.about-contact`, `.contact-grid` (+ media query), `.contact-intro .kicker`, `.contact-title`, `.contact-sub`, `.contact-tips` (+ `.tip`, `.tip-led`, `.tip-led.y`, `.tip-led.m`), `.contact-form` (+ `::before`, `.shake`), `.contact-form textarea` (+ `:focus`, `::placeholder`), `.btn.press:active`, `.terminal-success`, `.term-bar` (+ `.dot`, `.dot.r/.y/.g`, `.term-title`), `.term-body` (+ `.line`, `.prompt`, `.dim`, `.success`, `.caret`); más los keyframes `pxblink` y `shake`.
- Regla CSS nueva `.contact-error` (no existe en el template): texto pequeño en `var(--magenta)`, `font-family: var(--mono)`, margen superior, para el error inline del servidor.
- `.env.example` en la raíz con `RESEND_API_KEY=` y `CONTACT_TO=`.
- Dependencia `resend` añadida a `package.json` (y `package-lock.json`).
- Sección en `README.md` que documenta las dos variables de entorno y que hay que copiarlas a `.env.local`.
- `npm run lint` y `npm run build` pasan sin errores.

**Fuera de alcance (para futuras specs):**

- Remitente con dominio propio verificado en Resend (registros SPF/DKIM). Se usa `onboarding@resend.dev`, que solo entrega a la dirección dueña de la cuenta Resend.
- Rate limiting por IP, captcha o cualquier anti-spam más allá del honeypot y la validación de campos.
- Guardar los mensajes en una base de datos o en un log persistente.
- Autorespuesta al visitante confirmando la recepción.
- Route Handler / endpoint público `app/api/contact`: el envío es una Server Action.
- Plantilla HTML del correo con React Email: el cuerpo es texto plano.
- i18n, tests automatizados, backend real, rediseño visual (igual que SPEC 01 y SPEC 02).
- Portar los estilos de `styles.css` ajenos a esta pantalla (`GAMEPAD` / `.gp*`, `.spinner`, `.gp-themer`, keyframes `scorepop` / `spinpix`).

---

## 3 — Modelo de datos

Esta feature no introduce estructuras de datos persistentes. No hay `localStorage`, ni `lib/` nuevo, ni base de datos.

El único "dato" es la forma del estado que devuelve la Server Action y consume `useActionState`:

```ts
// app/acerca/actions.ts
type ContactState =
  | { ok: false; error?: string }        // estado inicial y errores
  | { ok: true; name?: string };         // envío correcto (name para el mensaje de la terminal)
```

Variables de entorno (en `.env.local`, no versionado; plantilla en `.env.example`):

```
RESEND_API_KEY   # API key generada en el panel de Resend
CONTACT_TO       # Email to contact
```

Convenciones:

- Slug de ruta en español: `/acerca`. Coherente con `/entrar`, `/salon`, `/biblioteca` de SPEC 01 y SPEC 02.
- El `from` del correo es la constante `"Arcade Vault <onboarding@resend.dev>"` en el código, no una variable de entorno.
- Los `className` son exactamente los de `references/templates/home-about/styles.css` tras portar los bloques nuevos a `app/globals.css`. La única clase que se escribe a mano es `.contact-error`.
- `HighlightIcon` se porta como función del módulo de la página (Server Component); los SVG son idénticos a `about.jsx`. El global `window.About` no se porta.
- El texto de `about-mission`, `contact-sub`, los `tip` y las líneas de la terminal se copian literalmente del template.

---

## 4 — Plan de implementación

1. **Dependencia y variables de entorno.** `npm install resend`. Crear `.env.example` con `RESEND_API_KEY=` y `CONTACT_TO=`. Añadir a `README.md` una nota de que hay que copiarlas a `.env.local`. Verificación: `npm run build` sigue en verde; `resend` aparece en `package.json`.
2. **Estilos de la pantalla.** Copiar a `app/globals.css`, desde `references/templates/home-about/styles.css`, el bloque `ABOUT PAGE` completo hasta `.term-body .caret` (lista exacta de selectores en la sección Alcance), más los keyframes `pxblink` y `shake`. No copiar `.reveal` / `.reveal.in`, `.field*` ni `@keyframes blink` (ya existen en `app/globals.css`). Añadir la regla nueva `.contact-error`. Verificación: `npm run build` en verde; ninguna regla nueva se usa todavía.
3. **Server Action.** Crear `app/acerca/actions.ts` (`"use server"`) con `sendContactMessage(prevState, formData)`: honeypot → `{ ok: true }`; validación de los 3 campos + formato de email → `{ ok: false, error }`; instanciar `new Resend(process.env.RESEND_API_KEY)` y `resend.emails.send({ from, to: process.env.CONTACT_TO, replyTo: email, subject, text })` dentro de `try/catch`; devolver `{ ok: true, name }` o `{ ok: false, error }`. `console.error` en el `catch` y cuando falten variables de entorno. Verificación: `npx tsc --noEmit` compila.
4. **Componente de formulario.** Crear `app/_components/contact-form.tsx` (`"use client"`): `useActionState(sendContactMessage, { ok: false })`; markup del `<form className="contact-form">` con los `.field` de nombre y correo, el `<textarea>` de mensaje, el input honeypot oculto y el botón. Estado `pending` → botón `ENVIANDO…` deshabilitado. Validación en cliente (campos vacíos) → clase `shake` 400 ms sin enviar. `state.ok` → bloque `terminal-success` con `ENVIAR OTRO MENSAJE` que resetea. `state.error` → `<p className="contact-error">`. Verificación: importable; render en servidor no rompe.
5. **Página `/acerca`.** Crear `app/acerca/page.tsx` (Server Component) que porta `about.jsx`: helper `HighlightIcon`, `about-hero` con kicker + título + `about-mission` + `highlight-row` (3 `highlight` con `transitionDelay`), `<Reveal className="about-divider">` con los 24 spans, y `<Reveal className="about-contact">` con `contact-grid` → `contact-intro` + `<ContactForm />`. Verificación: `/acerca` muestra hero, divisor y bloque de contacto con el formulario.
6. **Navbar.** Modificar `app/_components/nav.tsx`: añadir enlace "Acerca de" → `/acerca` tras "Salón de la Fama" en `.links` y en el panel móvil; `acercaActive = pathname === "/acerca"`. Verificación: en `/acerca` el enlace "Acerca de" aparece activo; en el resto de rutas, no.
7. **Cierre.** Configurar `.env.local` con una API key real de Resend y `CONTACT_TO`, y probar un envío de extremo a extremo (llega el correo, `reply_to` es el email del visitante). Ejecutar `npm run lint` y `npm run build` y dejar ambos en verde.

---

## 5 — Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] `resend` figura en `dependencies` de `package.json` y `.env.example` contiene `RESEND_API_KEY` y `CONTACT_TO`.
- [ ] `/acerca` muestra el `about-hero`: kicker "▸ ACERCA DE" en amarillo, título "ACERCA DE ARCADE VAULT", el párrafo de misión y las 3 tarjetas `highlight` (magenta / cyan / green) con su icono pixel y su texto.
- [ ] Al hacer scroll, el divisor y la sección de contacto aparecen con la transición `reveal` (opacidad 0 y desplazamiento a visible).
- [ ] El bloque de contacto muestra el kicker "▸ CONTACTO", el título "CONTÁCTANOS", el subtítulo y los 3 `tip` con sus LEDs, más el formulario con los campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE y el botón "▶ ENVIAR MENSAJE".
- [ ] Enviar con algún campo vacío no dispara la Server Action y aplica la animación `shake` al formulario.
- [ ] Con los 3 campos rellenos y un email con formato válido, al enviar el botón muestra "ENVIANDO…" y queda deshabilitado mientras se procesa.
- [ ] Tras un envío correcto se muestra el bloque `terminal-success` con la línea "> MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}." y el botón "ENVIAR OTRO MENSAJE", que al pulsarlo devuelve el formulario vacío.
- [ ] Un envío correcto entrega un correo a la dirección de `CONTACT_TO` cuyo `reply-to` es el email escrito por el visitante y cuyo asunto es "Arcade Vault · Nuevo mensaje de {NOMBRE}".
- [ ] Si `RESEND_API_KEY` o `CONTACT_TO` no están definidas, o Resend devuelve error, el formulario muestra el mensaje inline `.contact-error` y conserva lo escrito.
- [ ] Un envío con el campo honeypot (`company`) relleno no genera ningún correo y la UI muestra el estado de éxito.
- [ ] Un email con formato inválido (sin `@` o sin dominio) produce el error de validación del servidor, no un envío.
- [ ] La navbar muestra "Acerca de" como enlace a `/acerca`, activo solo en esa ruta, tanto en escritorio como en el panel móvil.
- [ ] El footer sigue apareciendo en `/acerca`.
- [ ] El aspecto de `/acerca` coincide con `references/templates/home-about/about.jsx` (mismos `className`, mismo orden de secciones).

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** ruta `/acerca`. Coherente con los slugs en español de SPEC 01 y SPEC 02 (`/entrar`, `/salon`, `/biblioteca`).
- **No:** `/about` o `/acerca-de`. `/about` rompe la coherencia de idioma; `/acerca-de` es más largo sin ganar claridad.
- **Sí:** envío mediante Server Action (`"use server"`) invocada con `useActionState`. Es lo idiomático en Next 16, mantiene la API key en el servidor, no expone endpoint público y da los estados `pending` y de error sin código extra.
- **No:** Route Handler `app/api/contact/route.ts` con `fetch` desde el cliente. Crea una API pública que habría que endurecer y validar por separado; solo aporta si un cliente externo necesitara enviar contacto, que no es el caso.
- **Sí:** remitente `onboarding@resend.dev`. Permite enviar sin verificar dominio; suficiente para un MVP, entrega a la dirección dueña de la cuenta Resend.
- **No:** dominio propio verificado ahora. Requiere configurar DNS/SPF/DKIM; se hará en su propia spec cuando exista dominio.
- **Sí:** `CONTACT_TO` y `RESEND_API_KEY` como variables de entorno en `.env.local`, con plantilla en `.env.example`. `.env*` ya está en `.gitignore`.
- **No:** fijar la dirección de destino en el código. Cambiarla no debe requerir un commit.
- **Sí:** `reply-to` con el email del visitante. Permite responder directamente desde la bandeja sin copiar la dirección del cuerpo.
- **Sí:** honeypot oculto (`company`) + validación de campos y formato de email en el servidor. Filtra bots básicos con coste casi nulo.
- **No:** rate limiting, captcha o almacenamiento de mensajes. Introducen estado en servidor y más superficie; van en otra spec si el spam lo justifica.
- **Sí:** conservar la animación `terminal-success` del template como estado de éxito y añadir un error inline (`.contact-error`) y el texto "ENVIANDO…" en el botón. Mantiene la fidelidad visual y cubre los estados que el prototipo no tenía.
- **No:** sustituir `terminal-success` por un toast. Perdería un elemento visual característico del template.
- **Sí:** cuerpo del correo en texto plano. Un mensaje de contacto interno no necesita plantilla HTML.
- **Sí:** página como Server Component con una única isla Client (`<ContactForm>`), reutilizando el `<Reveal>` de SPEC 02. Alineado con el modelo de SPEC 01 y SPEC 02.

---

## 7 — Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La API key de Resend acaba en el bundle del cliente. | La key solo se lee con `process.env.RESEND_API_KEY` dentro de `app/acerca/actions.ts` (`"use server"`); el componente cliente nunca la importa. |
| `onboarding@resend.dev` solo entrega a la dirección dueña de la cuenta; con otro `CONTACT_TO` el correo no llega. | Documentado en Alcance y en las decisiones; el criterio de aceptación del envío se valida con `CONTACT_TO` puesto a la dirección de la cuenta Resend. Dominio propio queda para otra spec. |
| Falta `RESEND_API_KEY` o `CONTACT_TO` en el entorno y el envío revienta. | La Server Action comprueba las variables y captura errores en `try/catch`, devolviendo `{ ok: false, error }`; la UI muestra el error inline en lugar de romperse. |
| Bots rellenan el formulario y generan spam. | Honeypot oculto + validación de campos y formato de email en servidor. Rate limit / captcha se dejan fuera de forma explícita. |
| `useActionState` es API de React 19 / Next 16 y puede diferir de lo conocido. | Antes de implementar el paso 4, leer la guía correspondiente en `node_modules/next/dist/docs/` (App Router, formularios y Server Actions), según pide `AGENTS.md`. |
| Portar los bloques de `styles.css` duplica reglas ya presentes en `app/globals.css` (`.reveal`, `.field`, `@keyframes blink`). | El paso 2 lista exactamente qué selectores y keyframes portar y cuáles omitir por existir ya. |
| El `<textarea>` del template no usa la clase `.field`; portarlo dentro de un `.field` cambia el aspecto. | Se porta el markup tal cual (`.field` solo para nombre y correo; el `textarea` va suelto con su regla `.contact-form textarea`). |

---

## Lo que **no** entra en esta spec

- Remitente con dominio propio verificado en Resend.
- Rate limiting, captcha o anti-spam más allá del honeypot y la validación.
- Guardar los mensajes de contacto en base de datos o autorespuesta al visitante.
- Route Handler / endpoint público para el envío.
- Cuerpo del correo en HTML con React Email.
- Estilos de `styles.css` ajenos a esta pantalla (`GAMEPAD`, `spinner`, `gp-themer`).
- i18n, tests automatizados, backend real y rediseño visual.

Cada uno de esos puntos, si llega, va en su propia spec.
