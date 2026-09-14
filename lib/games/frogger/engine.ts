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

type Phase = "playing" | "dying" | "over";

interface FrogPos {
  col: number;
  row: number;
  px: number; // desplazamiento horizontal respecto al centro de la celda (sobre un tronco)
}

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
  const laneOffsets: number[] = LANES.map((l) => l.offset);

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

  // ── Actualización de carriles ────────────────────────────────────────────────
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

  function update(dt: number) {
    if (phase === "over") return;
    updateLanes(dt);
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
      const len = patternLength(lane);
      const widthPx = lane.widthCells * CELL;
      const y = lane.row * CELL + 6;
      const h = CELL - 12;

      // El patrón se repite; se dibuja desde un ciclo antes del borde
      // izquierdo hasta cubrir todo el ancho del canvas.
      let x = laneOffsets[i] - len;
      while (x < GAME_W) {
        ctx.save();
        ctx.fillStyle = lane.color;
        if (lane.kind === "river") {
          const radius = 8;
          ctx.beginPath();
          ctx.roundRect(x, y, widthPx, h, radius);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, widthPx, h);
        }
        ctx.restore();
        x += len;
      }
    });
  }

  function drawFrog() {
    const x = frog.col * CELL + frog.px;
    const y = frog.row * CELL;
    const margin = 6;
    ctx.save();
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x + margin, y + margin, CELL - margin * 2, CELL - margin * 2);
    ctx.fillStyle = "#0f2f16";
    const eyeSize = 6;
    ctx.fillRect(x + margin + 4, y + margin + 4, eyeSize, eyeSize);
    ctx.fillRect(
      x + CELL - margin - 4 - eyeSize,
      y + margin + 4,
      eyeSize,
      eyeSize
    );
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
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    pause() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    resume() {
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
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
