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
  color: string;
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
    color: "#8a5a2b",
  },
  {
    row: 2,
    kind: "river",
    dir: -1,
    speed: 80,
    widthCells: 2,
    gapCells: 2,
    offset: 100,
    color: "#3ddc84",
  },
  {
    row: 3,
    kind: "river",
    dir: 1,
    speed: 50,
    widthCells: 4,
    gapCells: 3,
    offset: 200,
    color: "#8a5a2b",
  },
  {
    row: 4,
    kind: "river",
    dir: -1,
    speed: 70,
    widthCells: 2,
    gapCells: 2,
    offset: 50,
    color: "#3ddc84",
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
    color: "#ff2fb3",
  },
  {
    row: 7,
    kind: "road",
    dir: -1,
    speed: 150,
    widthCells: 2,
    gapCells: 3,
    offset: 150,
    color: "#66fff5",
  },
  {
    row: 8,
    kind: "road",
    dir: 1,
    speed: 100,
    widthCells: 1,
    gapCells: 2,
    offset: 300,
    color: "#f7ff4d",
  },
  {
    row: 9,
    kind: "road",
    dir: -1,
    speed: 180,
    widthCells: 1,
    gapCells: 4,
    offset: 80,
    color: "#ff5e5e",
  },
];

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
  destroy(): void;
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: FroggerSnapshot) => void }
): FroggerHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;

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

  function handleKeyDown(e: KeyboardEvent) {
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir) return;
    const active = !paused && (phase === "playing" || phase === "dying");
    if (active) e.preventDefault();
    if (paused || phase !== "playing") return;
    tryHop(dir);
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
        }
        emitState();
      }
      return;
    }

    // phase === "playing"
    if (hopping) {
      hopElapsedMs += dt * 1000;
      if (hopElapsedMs >= HOP_MS) {
        frog = { col: hopTo.col, row: hopTo.row, px: 0 };
        hopping = false;
        hopElapsedMs = 0;
      }
      return;
    }

    checkHazards(dt);
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function drawZones() {
    // Orilla de nidos (fila 0): juncos sólidos con huecos en NEST_COLS.
    ctx.fillStyle = "#0f2f16";
    ctx.fillRect(0, NEST_ROW * CELL, GAME_W, CELL);
    for (const col of NEST_COLS) {
      ctx.fillStyle = "#123a1b";
      ctx.fillRect(col * CELL + 4, NEST_ROW * CELL + 4, CELL - 8, CELL - 8);
    }

    // Río (filas 1-4).
    ctx.fillStyle = "#0a2540";
    ctx.fillRect(0, RIVER_ROWS[0] * CELL, GAME_W, RIVER_ROWS.length * CELL);

    // Mediana segura (fila 5).
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, MEDIAN_ROW * CELL, GAME_W, CELL);

    // Carretera (filas 6-9).
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, ROAD_ROWS[0] * CELL, GAME_W, ROAD_ROWS.length * CELL);

    // Orilla de salida (filas 10-11).
    ctx.fillStyle = "#0f2f16";
    ctx.fillRect(0, 10 * CELL, GAME_W, 2 * CELL);
  }

  function drawLaneElements() {
    LANES.forEach((lane, i) => {
      const rects = laneRects(lane, laneOffsets[i]);
      rects.forEach((r) => {
        ctx.save();
        ctx.fillStyle = lane.color;
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
    ctx.save();
    ctx.fillStyle = dying ? (blinkOn ? "#ff2d55" : "#5a0f1e") : "#22c55e";
    ctx.fillRect(x + margin, y + margin, CELL - margin * 2, CELL - margin * 2);
    if (!dying || blinkOn) {
      ctx.fillStyle = "#0f2f16";
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

  function draw() {
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    drawZones();
    drawLaneElements();
    drawFrog();
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
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
