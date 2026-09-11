---
name: spec-game
description: Designs the spec for a new playable game in Arcade Vault — real engine plus Supabase leaderboard. Ports a folder from references/started-games or designs one from scratch. Writes specs/NN-juego-<slug>.md; it never writes game code.
disable-model-invocation: true
argument-hint: "reference folder (03-tetris), game name, or a one-sentence description"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*)
---

# /spec-game — Spec designer for a new real game

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Specs that already exist:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Reference folders available to port:
!`ls references/started-games/ 2>/dev/null || echo "references/started-games/ does not exist"`

Engines already ported:
!`ls lib/games/ 2>/dev/null || echo "lib/games/ does not exist yet"`

---

This skill produces the spec for a new **real, playable game** — one with its own engine
mounted on a `<canvas>` and a leaderboard backed by Supabase — following the pattern that
SPEC 05 (asteroids engine) and SPEC 06 (Supabase leaderboard) already established.
**You don't write game code here.** Your job is to inventory the source (a reference
folder, or a description from scratch), ask what the platform's integration contract
leaves open, and write the spec section by section (or in one pass, if you already have
everything) until it's ready to save into `specs/`.

Your replies must be in the same language as the initial prompt — this repository's
specs are written in Spanish, so unless the user writes to you in another language, work
in Spanish.

## Philosophy

Porting a game by hand means re-reading two ~200-line specs and re-discovering the same
traps every time: that `insertScore` lives in `lib/scores-client.ts` and not in
`lib/scores.ts`, that the `engine` union appears in three places inside `lib/games.ts`,
that the canvas HUD gets deleted because React paints it instead. This skill has that
knowledge baked in via `contrato-plataforma.md` (in this same directory) so each new game
spec starts from the accumulated lessons instead of from zero.

Read `contrato-plataforma.md` before writing anything — it is the technical contract this
skill must respect at every step, not background reading. Read `../spec/template.md` for
the general shape a spec must follow in this repo.

## Command flow

Follow the five phases in order. **Never skip Phase 3** — the questions are the whole
point, same rule as `/spec`. Phase 4 has a fast path once Phase 3 is genuinely complete.

### Phase 1 — Locate the source and pick a mode

Resolve `$ARGUMENTS` against the reference-folder listing in the session context above.
Accept a bare number (`03`), a slug (`tetris`), or the full folder name (`03-tetris`) —
match loosely.

Two modes:

- **Port mode** (a matching folder exists under `references/started-games/`): read its
  `index.html`, `game.js` (and `style.css` / `assets/` if present) and produce a **port
  inventory** before asking anything. The inventory must cover, concretely and with line
  references where useful:
  - Canvas size and internal coordinate system.
  - Controls (keys, mouse, or both).
  - Module-level state vs. anything already encapsulated.
  - Where the HUD is painted today (canvas text, or DOM elements) and where game over is
    shown (canvas overlay, HTML overlay, or none).
  - How the game restarts today (a key, a button, both).
  - Any `localStorage` usage (records, themes, skins, settings).
  - Whether the timestep is `dt`-based (seconds) or per-frame (`x += vx` with no `dt`).
  - External assets (images, audio) and how their paths are referenced.
  - A secondary canvas, if any (e.g. a "next piece" preview).

  Present this inventory to the user before Phase 2 so they see what you found, but don't
  wait for confirmation on it — it feeds directly into the Phase 3 questions.

- **From-scratch mode** (no matching folder, or the user explicitly wants a new game with
  no reference): ask for a single-sentence description of the mechanic if `$ARGUMENTS`
  doesn't already give you one clearly. Do not invent a game the user hasn't described —
  this mode designs the engine's contract from the description, it doesn't hallucinate
  gameplay.

If `$ARGUMENTS` is empty, show the available reference folders (from the session context)
and ask whether this is a port or a from-scratch design.

### Phase 2 — Read the platform context

Mandatory, in this order, before asking any question:

1. `CLAUDE.md` and `AGENTS.md` — including the rule to check
   `node_modules/next/dist/docs/` before touching App Router code, since
   `app/juego/[id]/jugar/page.tsx` is one of the files this spec will change.
2. `specs/05-juego-asteroides.md` and `specs/06-leaderboard-y-catalogo-supabase.md` — the
   two precedents that fix structure, language (Spanish), and the exact wording this repo
   uses for states and section headings.
3. `../spec/template.md` — the section shape every spec in this repo follows.
4. `contrato-plataforma.md` (sibling file) — the integration points, the engine contract,
   the flexible HUD snapshot, the `engine → component` registry, and the recurring risks.
   This is the file that makes this skill more than a generic spec writer — don't skip it.

### Phase 3 — Ask in blocks with AskUserQuestion

Ask in blocks of 3 to 5 questions, waiting for an answer between blocks — never skip this
phase, same rule as `/spec`. Every block must arrive with **proposals derived from the
inventory** (Phase 1) and the contract (`contrato-plataforma.md`), not abstract questions.
Four blocks, always in this order:

1. **Catalog entry.** `id` (slug, becomes the primary key in `games`), `title`, `cat`
   (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `color` (`cyan|magenta|yellow|green`), and whether it
   reuses an existing `.cover-*` class (list the ones in `app/globals.css`: `cover-bricks`,
   `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`,
   `cover-rana`, `cover-duelo`) or needs a new one. If new, note in the spec that its
   implementation goes through `/frontend-design` per `CLAUDE.md`.
2. **HUD and snapshot.** Which metrics from the game go into `.hud-stat` entries and with
   what label, following the flexible snapshot from `contrato-plataforma.md` section (c).
   Propose a mapping from the inventory — e.g. a Tetris-like game suggests
   Líneas/Nivel/Combo; a game with no built-in lives or score (like the Arkanoid
   reference) needs those invented explicitly, so ask directly whether and how.
3. **Controls and cuts.** Which keys survive, and what gets removed from the original:
   `localStorage` records, themes/skins, sound, HTML overlays, restart-by-key, a second
   canvas. Every accepted cut becomes an explicit "Fuera de alcance" line in the spec —
   don't let anything get silently dropped without recording it.
4. **Canvas and closing.** Internal resolution and aspect ratio (`.game-canvas` currently
   fixes `4 / 3` — if the source canvas has a different ratio, this needs an explicit
   decision per `contrato-plataforma.md` section (a), not a silent stretch), and a final
   check for anything else the user wants left out on purpose.

If the user wants to skip this phase, respect it but record "Definición rápida sin
preguntas detalladas" in the spec's decisions section, same as `/spec` does.

### Phase 4 — Write the spec

**If you already have everything** you need after Phase 3 — you can name the exact files
that change, the first and last implementation steps, and how to verify completion —
write the whole spec in one pass and move to Phase 5. Don't ask for section-by-section
confirmation when the user already answered everything.

**Only if information is still missing**, develop the sections one by one, showing each
and waiting for confirmation before the next.

Numbering: take the highest number in `specs/` (from the session context) and add one,
zero-padded to two digits. Slug: `juego-<nombre>` (e.g. `07-juego-tetris.md`), matching
the `NN-juego-asteroides.md`-shaped precedent of SPEC 05.

Content, always in Spanish, state `Borrador`, date from the session context (never
guessed), `**Depende de:** SPEC 05, SPEC 06`:

1. **1 — Por qué existe esta spec.** What's being ported (name the reference folder) or
   designed from scratch, and why this game now.
2. **2 — Alcance.**
   - **Dentro:** enumerate the concrete files from `contrato-plataforma.md` section (a) —
     the Supabase migration, `lib/games.ts`'s three touch points, the new
     `lib/games/<juego>/engine.ts`, `lib/games/types.ts` if this is the first game to need
     the flexible snapshot, the wrapper component, the `engine → componente` registry in
     `app/juego/[id]/jugar/page.tsx` (introduce it now if no prior game-spec created it
     yet), and `app/globals.css` only if a new cover or aspect ratio is needed.
   - **Fuera de alcance:** every cut from Phase 3 block 3, plus the standing exclusions
     from SPEC 05/06 that still apply (no real auth, no `plays` counter, no rate limiting
     on inserts, no realtime).
3. **3 — Modelo de datos.** The engine's snapshot interface and handle (following section
   (b) and, if applicable, (c) of the contract), the `games` row to insert, and the SQL
   `insert` statement — no `scores` seed rows.
4. **4 — Plan de implementación.** Numbered steps in the dependency order of
   `contrato-plataforma.md` section (a): migration → `lib/games.ts` → engine → (shared
   types if needed) → wrapper → page registry → CSS if needed → lint/build. Each step
   must leave the system functional, per the general spec rules in `../spec/template.md`.
5. **5 — Criterios de aceptación.** The game-specific ones the user defined, plus **always**
   the platform invariants listed in `contrato-plataforma.md` section (g) verbatim (build
   and lint green, engine has no `react`/`next` imports, the catalog row exists with its
   `engine`, saving a score surfaces it in `/salon`, a failed insert shows an inline error
   without losing the game, no leaked RAF/listeners on navigation, games without `engine`
   keep using `<GamePlayer>`).
6. **6 — Decisiones tomadas y descartadas.** Every answer from Phase 3, each with its
   one-line reason. Include the known divergence noted in `contrato-plataforma.md` (c) if
   this game uses the flexible snapshot: `lib/games/asteroids/engine.ts` is not refactored
   to match it.
7. **7 — Riesgos.** Pull in the recurring risks table from `contrato-plataforma.md`
   section (g), plus anything specific to this port (e.g. a secondary canvas, external
   assets, mouse input).
8. **Cierre — Lo que no entra en esta spec.** Repeat the "Fuera de alcance" list.

Before writing, double-check the referenced specs (SPEC 05, SPEC 06) actually exist in
`specs/` — they do today, but don't assume blindly if the repo has changed.

### Phase 5 — Save and stop

1. Write the file directly at `specs/NN-juego-<slug>.md`. Don't ask for permission to
   write it or whether the name works — announce the path in the final confirmation. Only
   ask if the target file already exists.
2. Confirm to the user:
   - Path of the created file.
   - Reminder: the spec is in `Borrador`. A human changes it to `Aprobado` after
     re-reading it.
   - Next step: once approved, run `/spec-impl NN-juego-<slug>` to implement it.
   - **Stop here.**

## Hard rules

- **Never write game code, and never touch Supabase.** Only the spec's `.md` file, ever.
- **Never propose implementing the spec after saving it.** Your job ends at the
  confirmation. `/spec-impl` is a separate, explicit step for the user.
- **Never assume the `id`, category, or color.** They come from Phase 3, block 1 —
  never invent them to move faster.
- **Never paste the reference game's source code into the spec.** The spec describes the
  port (what changes, and why) — it does not contain the engine itself. Short illustrative
  snippets for the data model are fine, per the general spec rules; full functions are not.
- **Never silently refactor `lib/games/asteroids/engine.ts`.** Even when introducing the
  flexible snapshot type or the `engine → componente` registry, asteroids' existing
  snapshot and its branch in the page stay working exactly as they are.
- **Never skip `contrato-plataforma.md`.** If you find yourself guessing where
  `insertScore` lives, or how many places `lib/games.ts` needs to change, stop and re-read
  it — that's exactly what it exists to prevent.

## Arguments

`$ARGUMENTS` can be a reference folder (`03-tetris`, `03`, `tetris`), a game name with no
reference, or a one-sentence description of a game to design from scratch. Phase 1 decides
which mode applies. If it's ambiguous, ask.
