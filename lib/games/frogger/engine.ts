// ===== lib/games/frogger/engine.ts — motor de "salta-charcos" (frogger-like), =====
// ===== diseñado desde cero, sin referencia en references/started-games/ =====
//
// Módulo de DOM puro: no importa nada de react ni de next/*. Todo el estado
// de una partida vive dentro de `createFroggerGame`; a nivel de módulo solo
// quedan constantes puras.

import type { GameSnapshot } from "@/lib/games/types";

const GAME_W = 800;
const GAME_H = 600;
const CELL = 50; // grid de 16 columnas x 12 filas
const COLS = GAME_W / CELL;
const ROWS = GAME_H / CELL;

const START_COL = 8;
const START_ROW = 11;
const LIVES = 3;
const CROSS_TIME_S = 30;
const HOP_MS = 90;
const DEATH_FLASH_MS = 500;
const NEST_COLS = [1, 4, 7, 10, 13];
const POINTS_ROW = 10;
const POINTS_NEST = 50;
const POINTS_PER_TIME_SECOND = 10;
const POINTS_ROUND = 500;
const ROUND_SPEED_STEP = 0.12;
const MAX_SPEED_MULT = 2.2;
const COLLISION_TOLERANCE = 4; // px por lado, para que el borde exacto no mate

// ── Disposición del tablero ──────────────────────────────────────────────────
// fila 0 = orilla de nidos, filas 1-4 = río, fila 5 = mediana segura,
// filas 6-9 = carretera, filas 10-11 = orilla de salida (la rana arranca en 11).
const NEST_ROW = 0;
const RIVER_ROWS = [1, 2, 3, 4];
const MEDIAN_ROW = 5;
const ROAD_ROWS = [6, 7, 8, 9];

type LaneKind = "road" | "river";

interface Lane {
  row: number; // 1..4 río, 6..9 carretera
  kind: LaneKind;
  dir: 1 | -1; // 1 = hacia la derecha
  speed: number; // px/s a multiplicador de ronda 1
  widthCells: number; // ancho de cada elemento en celdas
  gapCells: number; // hueco entre elementos, en celdas
  offset: number; // desfase inicial del patrón, en píxeles
  // El color no vive aquí: lo aporta el skin activo por índice de carril
  // (`Skin["colors"]["lanes"][i]`), para que la geometría sea común a los tres.
}

const LANES: readonly Lane[] = [
  // Río (filas 1-4): troncos y nenúfares.
  {
    row: 1,
    kind: "river",
    dir: 1,
    speed: 60,
    widthCells: 3,
    gapCells: 2,
    offset: 0,
  },
  {
    row: 2,
    kind: "river",
    dir: -1,
    speed: 80,
    widthCells: 2,
    gapCells: 2,
    offset: 100,
  },
  {
    row: 3,
    kind: "river",
    dir: 1,
    speed: 50,
    widthCells: 4,
    gapCells: 3,
    offset: 200,
  },
  {
    row: 4,
    kind: "river",
    dir: -1,
    speed: 70,
    widthCells: 2,
    gapCells: 2,
    offset: 50,
  },
  // Carretera (filas 6-9): vehículos.
  {
    row: 6,
    kind: "road",
    dir: 1,
    speed: 120,
    widthCells: 1,
    gapCells: 2,
    offset: 0,
  },
  {
    row: 7,
    kind: "road",
    dir: -1,
    speed: 150,
    widthCells: 2,
    gapCells: 3,
    offset: 150,
  },
  {
    row: 8,
    kind: "road",
    dir: 1,
    speed: 100,
    widthCells: 1,
    gapCells: 2,
    offset: 300,
  },
  {
    row: 9,
    kind: "road",
    dir: -1,
    speed: 180,
    widthCells: 1,
    gapCells: 4,
    offset: 80,
  },
];

// ── Skins ────────────────────────────────────────────────────────────────────
// Los tres skins comparten geometría y física: solo cambian paleta y, vía
// `style`, si el trazo lleva glow (`neon`) o borde duro (`flat`). Todos los
// colores de primer plano superan 4.5:1 contra el `#000` de `.game-canvas`
// salvo las excepciones registradas en references/game-with-themes.md.
export type FroggerSkin = "clasico" | "retro" | "neon";

interface SkinColors {
  // Un color por carril, en el mismo orden que LANES (0-3 río, 4-7 carretera).
  lanes: readonly string[];
  // Superficies de fondo (no son primer plano: se mantienen oscuras a propósito).
  nestShore: string;
  nestBox: string;
  river: string;
  median: string;
  road: string;
  startShore: string;
  // Primer plano.
  nestFree: string;
  nestTaken: string;
  frog: string;
  frogEye: string;
  frogDyingOn: string;
  frogDyingOff: string; // fotograma apagado del parpadeo: oscuro a propósito
  clockTrack: string; // parte vacía de la barra = fondo
  clockOk: string;
  clockLow: string;
}

interface Skin {
  style: "flat" | "neon";
  glow: number; // shadowBlur en px; 0 = sin sombra, bordes duros
  colors: SkinColors;
}

const SKINS: Record<FroggerSkin, Skin> = {
  // Valores calcados del motor original, sin alterar un solo dígito.
  clasico: {
    style: "flat",
    glow: 0,
    colors: {
      lanes: [
        "#8a5a2b", // tronco
        "#3ddc84", // nenúfar
        "#8a5a2b", // tronco
        "#3ddc84", // nenúfar
        "#ff2fb3",
        "#66fff5",
        "#f7ff4d",
        "#ff5e5e",
      ],
      nestShore: "#0f2f16",
      nestBox: "#123a1b",
      river: "#0a2540",
      median: "#1a1a1a",
      road: "#141414",
      startShore: "#0f2f16",
      nestFree: "#1d5a2a",
      nestTaken: "#2f6b3c",
      frog: "#22c55e",
      frogEye: "#0f2f16",
      frogDyingOn: "#ff2d55",
      frogDyingOff: "#5a0f1e",
      clockTrack: "#000",
      clockOk: "#ffdd55",
      clockLow: "#ff4d4d",
    },
  },
  // Fósforo ámbar: cinco tonos de una misma familia, formas planas, sin glow.
  retro: {
    style: "flat",
    glow: 0,
    colors: {
      lanes: [
        "#c9761a", // tronco (6.09:1)
        "#ffc14d", // nenúfar (12.99:1)
        "#c9761a",
        "#ffc14d",
        "#ffb000", // 11.46:1
        "#c9761a", // 6.09:1
        "#ffb000",
        "#c9761a",
      ],
      nestShore: "#2a1c06",
      nestBox: "#3a2708",
      river: "#181206",
      median: "#241a08",
      road: "#0d0a05",
      startShore: "#2a1c06",
      nestFree: "#ffc14d", // 12.99:1
      nestTaken: "#d98a2b", // 7.62:1
      frog: "#ffe9b5", // 17.57:1
      frogEye: "#b36b00", // 5.02:1 sobre negro, 3.50:1 sobre el cuerpo
      frogDyingOn: "#ff8c1a", // 9.02:1
      frogDyingOff: "#4a2200",
      clockTrack: "#000",
      clockOk: "#ffc14d",
      clockLow: "#ff8c1a",
    },
  },
  // Alto contraste sobre negro: río en tonos fríos, carretera en cálidos,
  // glow del propio trazo. El relleno se lee igual con shadowBlur = 0.
  neon: {
    style: "neon",
    glow: 12,
    colors: {
      lanes: [
        "#c77dff", // tronco violeta (7.81:1)
        "#00e5ff", // nenúfar cian (13.65:1)
        "#c77dff",
        "#00e5ff",
        "#ff2fb3", // 6.31:1
        "#ffa63d", // 10.77:1
        "#f7ff4d", // 19.37:1
        "#ff5e5e", // 7.01:1
      ],
      nestShore: "#061a0e",
      nestBox: "#0a2614",
      river: "#040f22",
      median: "#12121a",
      road: "#08080e",
      startShore: "#061a0e",
      nestFree: "#39ff88", // 15.83:1
      nestTaken: "#2bbf6a", // 8.76:1
      frog: "#aaff66", // 17.21:1
      frogEye: "#ff2fb3", // 6.31:1 sobre negro, 2.73:1 sobre el cuerpo
      frogDyingOn: "#ff2d55", // 5.76:1
      frogDyingOff: "#3a0a16",
      clockTrack: "#000",
      clockOk: "#f7ff4d",
      clockLow: "#ff2d55",
    },
  },
};

const LANE_BY_ROW = new Map<number, { lane: Lane; index: number }>();
LANES.forEach((lane, index) => LANE_BY_ROW.set(lane.row, { lane, index }));

type Phase = "playing" | "dying" | "over";

interface FrogPos {
  col: number;
  row: number;
  px: number; // desplazamiento horizontal respecto al centro de la celda (sobre un tronco)
}

interface GridPos {
  col: number;
  row: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Direction = "up" | "down" | "left" | "right";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const DIRECTION_DELTAS: Record<Direction, GridPos> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

// ── Contrato público ─────────────────────────────────────────────────────────
export interface FroggerSnapshot extends GameSnapshot {
  lives: number; // vidas restantes, empieza en LIVES = 3
  round: number; // ronda actual, empieza en 1
}

export interface FroggerHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  /** Cambia la paleta en caliente, sin destruir la partida en curso. */
  setSkin(skin: FroggerSkin): void;
  /** Equivalente táctil de un keydown: ejecuta un salto en esa dirección. */
  press(code: string): void;
  /** Frogger no reacciona a keyup: no-op, igual que con teclado físico. */
  release(code: string): void;
  destroy(): void;
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: FroggerSnapshot) => void; skin?: FroggerSkin }
): FroggerHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Skin activo: si falta o no se reconoce el valor, cae en `clasico`.
  let skinName: FroggerSkin =
    opts.skin && SKINS[opts.skin] ? opts.skin : "clasico";
  let skin: Skin = SKINS[skinName];

  // Estado de partida: encapsulado por completo dentro de la fábrica.
  let phase: Phase;
  let frog: FrogPos;
  let score: number;
  let lives: number;
  let round: number;
  let speedMult: number;
  let paused: boolean;
  const laneOffsets: number[] = LANES.map((l) => l.offset);

  // Salto discreto: mientras `hopping` es true no se acepta ni se encola
  // ninguna pulsación nueva.
  let hopping: boolean;
  let hopFrom: FrogPos;
  let hopTo: GridPos;
  let hopElapsedMs: number;

  let dyingElapsedMs: number;

  // Reloj del cruce, fila máxima de la vida actual y nichos ocupados en la ronda.
  let crossTimer: number;
  let bestRow: number;
  let occupiedNests: Set<number>;

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let lastSnapshot: FroggerSnapshot | null = null;

  function initGame() {
    phase = "playing";
    frog = { col: START_COL, row: START_ROW, px: 0 };
    score = 0;
    lives = LIVES;
    round = 1;
    speedMult = 1;
    paused = false;
    hopping = false;
    hopElapsedMs = 0;
    dyingElapsedMs = 0;
    crossTimer = CROSS_TIME_S;
    bestRow = START_ROW;
    occupiedNests = new Set();
    LANES.forEach((l, i) => {
      laneOffsets[i] = l.offset;
    });
    emitState();
  }

  // Solo notifica al wrapper de React cuando cambia score/lives/round/over.
  function emitState() {
    const snapshot: FroggerSnapshot = {
      score,
      over: phase === "over",
      lives,
      round,
      stats: [
        { l: "Puntuación", v: String(score) },
        { l: "Vidas", v: String(lives) },
        { l: "Ronda", v: String(round) },
      ],
    };
    if (
      lastSnapshot &&
      lastSnapshot.score === snapshot.score &&
      lastSnapshot.lives === snapshot.lives &&
      lastSnapshot.round === snapshot.round &&
      lastSnapshot.over === snapshot.over
    ) {
      return;
    }
    lastSnapshot = snapshot;
    opts.onState(snapshot);
  }

  // ── Carriles: movimiento y geometría compartida entre dibujo y colisión ────
  function patternLength(lane: Lane): number {
    return (lane.widthCells + lane.gapCells) * CELL;
  }

  function updateLanes(dt: number) {
    LANES.forEach((lane, i) => {
      const len = patternLength(lane);
      let next = laneOffsets[i] + lane.dir * lane.speed * speedMult * dt;
      next = ((next % len) + len) % len;
      laneOffsets[i] = next;
    });
  }

  function laneRects(lane: Lane, offset: number): Rect[] {
    const len = patternLength(lane);
    const widthPx = lane.widthCells * CELL;
    const y = lane.row * CELL + 6;
    const h = CELL - 12;
    const rects: Rect[] = [];
    let x = offset - len;
    while (x < GAME_W) {
      rects.push({ x, y, w: widthPx, h });
      x += len;
    }
    return rects;
  }

  // ── Colisiones ───────────────────────────────────────────────────────────────
  function overlaps(a: Rect, b: Rect, tolerance: number): boolean {
    const ax1 = a.x + tolerance;
    const ay1 = a.y + tolerance;
    const ax2 = a.x + a.w - tolerance;
    const ay2 = a.y + a.h - tolerance;
    const bx1 = b.x;
    const by1 = b.y;
    const bx2 = b.x + b.w;
    const by2 = b.y + b.h;
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
  }

  function frogRect(): Rect {
    return {
      x: frog.col * CELL + frog.px,
      y: frog.row * CELL,
      w: CELL,
      h: CELL,
    };
  }

  function checkRoadCollision(): boolean {
    const entry = LANE_BY_ROW.get(frog.row);
    if (!entry || entry.lane.kind !== "road") return false;
    const rects = laneRects(entry.lane, laneOffsets[entry.index]);
    const fr = frogRect();
    return rects.some((r) => overlaps(fr, r, COLLISION_TOLERANCE));
  }

  function riverPlatformUnderFrog(): Rect | null {
    const entry = LANE_BY_ROW.get(frog.row);
    if (!entry || entry.lane.kind !== "river") return null;
    const rects = laneRects(entry.lane, laneOffsets[entry.index]);
    const fr = frogRect();
    return rects.find((r) => overlaps(fr, r, COLLISION_TOLERANCE)) ?? null;
  }

  function triggerDeath() {
    if (phase !== "playing") return;
    phase = "dying";
    dyingElapsedMs = 0;
    emitState();
  }

  // Se llama justo cuando un salto termina, con `frog` ya en la celda destino.
  function handleLanding() {
    if (frog.row === NEST_ROW) {
      if (NEST_COLS.includes(frog.col) && !occupiedNests.has(frog.col)) {
        occupiedNests.add(frog.col);
        score += POINTS_NEST + Math.floor(crossTimer) * POINTS_PER_TIME_SECOND;
        frog = { col: START_COL, row: START_ROW, px: 0 };
        crossTimer = CROSS_TIME_S;
        if (occupiedNests.size >= NEST_COLS.length) {
          score += POINTS_ROUND;
          round += 1;
          occupiedNests.clear();
          speedMult = Math.min(MAX_SPEED_MULT, speedMult + ROUND_SPEED_STEP);
        }
        emitState();
      } else {
        triggerDeath();
      }
      return;
    }
    if (frog.row < bestRow) {
      bestRow = frog.row;
      score += POINTS_ROW;
      emitState();
    }
  }

  function checkHazards(dt: number) {
    if (ROAD_ROWS.includes(frog.row)) {
      if (checkRoadCollision()) triggerDeath();
      return;
    }
    if (RIVER_ROWS.includes(frog.row)) {
      const platform = riverPlatformUnderFrog();
      if (!platform) {
        triggerDeath();
        return;
      }
      const lane = LANE_BY_ROW.get(frog.row)!.lane;
      frog.px += lane.dir * lane.speed * speedMult * dt;
      const centerX = frog.col * CELL + frog.px + CELL / 2;
      if (centerX < 0 || centerX > GAME_W) triggerDeath();
    }
  }

  // ── Salto del jugador ────────────────────────────────────────────────────────
  function tryHop(dir: Direction) {
    if (hopping || phase !== "playing") return;
    const delta = DIRECTION_DELTAS[dir];
    const targetCol = frog.col + delta.col;
    const targetRow = frog.row + delta.row;
    if (
      targetCol < 0 ||
      targetCol >= COLS ||
      targetRow < 0 ||
      targetRow >= ROWS
    ) {
      return; // el salto que sacaría a la rana del grid no se ejecuta
    }
    hopping = true;
    hopFrom = { ...frog };
    hopTo = { col: targetCol, row: targetRow };
    hopElapsedMs = 0;
  }

  // Camino único de control, compartido por el teclado y los botones táctiles.
  // `code` usa los mismos strings que KeyboardEvent.code/key para las flechas.
  function runDirection(code: string) {
    const dir = KEY_TO_DIRECTION[code];
    if (!dir) return;
    if (paused || phase !== "playing") return;
    tryHop(dir);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir) return;
    const active = !paused && (phase === "playing" || phase === "dying");
    if (active) e.preventDefault();
    runDirection(e.key);
  }

  // ── Bucle de actualización ───────────────────────────────────────────────────
  function update(dt: number) {
    if (phase === "over") return;

    updateLanes(dt);

    if (phase === "dying") {
      dyingElapsedMs += dt * 1000;
      if (dyingElapsedMs >= DEATH_FLASH_MS) {
        lives -= 1;
        if (lives <= 0) {
          phase = "over";
        } else {
          phase = "playing";
          frog = { col: START_COL, row: START_ROW, px: 0 };
          hopping = false;
          crossTimer = CROSS_TIME_S;
          bestRow = START_ROW;
        }
        emitState();
      }
      return;
    }

    // phase === "playing"
    crossTimer -= dt;
    if (crossTimer <= 0) {
      crossTimer = 0;
      triggerDeath();
      return;
    }

    if (hopping) {
      hopElapsedMs += dt * 1000;
      if (hopElapsedMs >= HOP_MS) {
        frog = { col: hopTo.col, row: hopTo.row, px: 0 };
        hopping = false;
        hopElapsedMs = 0;
        handleLanding();
      }
      return;
    }

    checkHazards(dt);
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  // Aplica el glow del skin `neon`; en `flat` deja el borde duro. El relleno
  // nunca depende de la sombra: la forma se lee igual con shadowBlur = 0.
  function applyGlow(color: string) {
    if (skin.style === "neon") {
      ctx.shadowBlur = skin.glow;
      ctx.shadowColor = color;
    }
  }

  function drawZones() {
    const c = skin.colors;
    // Orilla de nidos (fila 0): juncos sólidos con huecos en NEST_COLS.
    ctx.fillStyle = c.nestShore;
    ctx.fillRect(0, NEST_ROW * CELL, GAME_W, CELL);
    for (const col of NEST_COLS) {
      const x = col * CELL;
      const y = NEST_ROW * CELL;
      ctx.fillStyle = c.nestBox;
      ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
      ctx.save();
      if (occupiedNests.has(col)) {
        // Nicho ocupado: rana apagada, sin brillo.
        ctx.fillStyle = c.nestTaken;
        ctx.fillRect(x + 14, y + 14, CELL - 28, CELL - 28);
      } else {
        // Nicho libre: hueco con brillo.
        applyGlow(c.nestFree);
        ctx.fillStyle = c.nestFree;
        ctx.fillRect(x + 10, y + 10, CELL - 20, CELL - 20);
      }
      ctx.restore();
    }

    // Río (filas 1-4).
    ctx.fillStyle = c.river;
    ctx.fillRect(0, RIVER_ROWS[0] * CELL, GAME_W, RIVER_ROWS.length * CELL);

    // Mediana segura (fila 5).
    ctx.fillStyle = c.median;
    ctx.fillRect(0, MEDIAN_ROW * CELL, GAME_W, CELL);

    // Carretera (filas 6-9).
    ctx.fillStyle = c.road;
    ctx.fillRect(0, ROAD_ROWS[0] * CELL, GAME_W, ROAD_ROWS.length * CELL);

    // Orilla de salida (filas 10-11).
    ctx.fillStyle = c.startShore;
    ctx.fillRect(0, 10 * CELL, GAME_W, 2 * CELL);
  }

  function drawLaneElements() {
    LANES.forEach((lane, i) => {
      const color = skin.colors.lanes[i];
      const rects = laneRects(lane, laneOffsets[i]);
      rects.forEach((r) => {
        ctx.save();
        applyGlow(color);
        ctx.fillStyle = color;
        if (lane.kind === "river") {
          ctx.beginPath();
          ctx.roundRect(r.x, r.y, r.w, r.h, 8);
          ctx.fill();
        } else {
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        ctx.restore();
      });
    });
  }

  function frogVisualPos(): { x: number; y: number } {
    if (hopping) {
      const t = Math.min(1, hopElapsedMs / HOP_MS);
      const fromX = hopFrom.col * CELL + hopFrom.px;
      const fromY = hopFrom.row * CELL;
      const toX = hopTo.col * CELL;
      const toY = hopTo.row * CELL;
      return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t };
    }
    return { x: frog.col * CELL + frog.px, y: frog.row * CELL };
  }

  function drawFrog() {
    const { x, y } = frogVisualPos();
    const margin = 6;
    const dying = phase === "dying";
    const blinkOn = Math.floor(dyingElapsedMs / 100) % 2 === 0;
    const c = skin.colors;
    const body = dying ? (blinkOn ? c.frogDyingOn : c.frogDyingOff) : c.frog;
    ctx.save();
    // El fotograma apagado del parpadeo no lleva glow: su función es
    // desaparecer contra el fondo durante medio segundo.
    if (!dying || blinkOn) applyGlow(body);
    ctx.fillStyle = body;
    ctx.fillRect(x + margin, y + margin, CELL - margin * 2, CELL - margin * 2);
    if (!dying || blinkOn) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.frogEye;
      const eyeSize = 6;
      ctx.fillRect(x + margin + 4, y + margin + 4, eyeSize, eyeSize);
      ctx.fillRect(
        x + CELL - margin - 4 - eyeSize,
        y + margin + 4,
        eyeSize,
        eyeSize
      );
    }
    ctx.restore();
  }

  function drawClockBar() {
    const frac = Math.max(0, crossTimer / CROSS_TIME_S);
    const c = skin.colors;
    const bar = frac > 0.3 ? c.clockOk : c.clockLow;
    ctx.save();
    ctx.fillStyle = c.clockTrack;
    ctx.fillRect(0, 0, GAME_W, 6);
    applyGlow(bar);
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, GAME_W * frac, 6);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    drawZones();
    drawLaneElements();
    drawFrog();
    drawClockBar();
  }

  // ── Bucle principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();

  return {
    start() {
      window.addEventListener("keydown", handleKeyDown);
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    pause() {
      paused = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    resume() {
      paused = false;
      if (rafId === null) {
        lastTime = null;
        rafId = requestAnimationFrame(loop);
      }
    },
    restart() {
      initGame();
    },
    end() {
      phase = "over";
      emitState();
    },
    // Reemplaza la paleta en caliente: el siguiente frame ya se pinta con el
    // skin nuevo y la partida en curso sigue intacta.
    setSkin(next: FroggerSkin) {
      skinName = SKINS[next] ? next : "clasico";
      skin = SKINS[skinName];
      // En pausa no hay bucle que repinte: refresca el frame actual a mano.
      if (rafId === null) draw();
    },
    press(code: string) {
      runDirection(code);
    },
    release() {
      // no-op: Frogger no reacciona a keyup, igual que con teclado físico.
    },
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
