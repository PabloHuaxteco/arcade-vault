// ===== lib/games/tetris/engine.ts — motor de "caída" (tetris), portado de =====
// ===== references/started-games/03-tetris/game.js =====
//
// Módulo de DOM puro: no importa nada de react ni de next/*. Todo el estado
// de una partida vive dentro de `createTetrisGame`; a nivel de módulo solo
// quedan constantes y utilidades puras.

import type { GameSnapshot } from "@/lib/games/types";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

type Cell = number; // 0 = vacío, 1-9 = índice de color/pieza
type Board = Cell[][];
type PieceShape = number[][];

interface Piece {
  type: number;
  shape: PieceShape;
  x: number;
  y: number;
}

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#b0bec5", // Tuerca - gris metálico
  "#ff1744", // Bomba - power-up (rojo intenso)
];

const PIECES: (PieceShape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // Tuerca (reto): anillo 3x3 con hueco central
  [[9]], // Bomba (power-up): 1x1, al bloquear destruye un área 3x3
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const BOMB = 9; // índice de la pieza bomba en PIECES/COLORS
const BOMB_RADIUS = 1; // radio de la explosión → área (2*r+1) x (2*r+1) = 3x3
const BOMB_BLOCK_SCORE = 10; // puntos por bloque destruido, multiplicados por level

const GRID_COLOR = "#22222e";

export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";

interface Skin {
  style: "flat" | "neon" | "pastel" | "pixel";
  colors: (string | null)[];
  grid?: string;
}

const SKINS: Record<TetrisSkin, Skin> = {
  retro: {
    style: "flat",
    colors: COLORS,
  },
  neon: {
    style: "neon",
    grid: "#101018",
    colors: [
      null,
      "#00f0ff",
      "#ffe600",
      "#d400ff",
      "#00ff85",
      "#ff003c",
      "#2979ff",
      "#ff9100",
      "#c0d0e0",
      "#ff1744",
    ],
  },
  pastel: {
    style: "pastel",
    colors: [
      null,
      "#a0e7e5",
      "#fdffb6",
      "#d8b4f8",
      "#b9fbc0",
      "#ffadad",
      "#a3c4f3",
      "#ffd6a5",
      "#cfd8dc",
      "#ff8fa3",
    ],
  },
  pixel: {
    style: "pixel",
    colors: [
      null,
      "#3fb8c7",
      "#e6c14a",
      "#a860b8",
      "#6fb573",
      "#cf6060",
      "#7fabd8",
      "#e0a24d",
      "#9aa6ad",
      "#e6304a",
    ],
  },
};

// ── Utilidades puras ──────────────────────────────────────────────────────────
function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 9) + 1;
  const base = PIECES[type];
  if (!base) throw new Error("Índice de pieza inválido.");
  const shape = base.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(
  board: Board,
  shape: PieceShape,
  ox: number,
  oy: number
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: PieceShape): PieceShape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: PieceShape = Array.from({ length: cols }, () =>
    new Array(rows).fill(0)
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function merge(board: Board, piece: Piece) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        board[piece.y + r][piece.x + c] = piece.shape[r][c];
}

function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function bombCells(piece: Piece): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] === BOMB && piece.y + r >= 0)
        cells.push({ x: piece.x + c, y: piece.y + r });
  return cells;
}

function explode(board: Board, cells: { x: number; y: number }[]): number {
  let destroyed = 0;
  for (const { x, y } of cells) {
    for (let r = y - BOMB_RADIUS; r <= y + BOMB_RADIUS; r++) {
      for (let c = x - BOMB_RADIUS; c <= x + BOMB_RADIUS; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (board[r][c]) {
          board[r][c] = 0;
          destroyed++;
        }
      }
    }
  }
  return destroyed;
}

function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

// ── Dibujo ─────────────────────────────────────────────────────────────────────
function drawBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  skin: Skin,
  alpha = 1
) {
  if (!colorIndex) return;
  const color = skin.colors[colorIndex];
  if (!color) return;
  const px = x * size;
  const py = y * size;
  context.save();
  context.globalAlpha = alpha;

  if (skin.style === "neon") {
    context.shadowColor = color;
    context.shadowBlur = size * 0.55;
    context.fillStyle = color;
    context.fillRect(px + 2, py + 2, size - 4, size - 4);
    context.shadowBlur = 0;
    context.fillStyle = "rgba(0,0,0,0.45)";
    context.fillRect(px + size * 0.3, py + size * 0.3, size * 0.4, size * 0.4);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  } else if (skin.style === "pastel") {
    context.fillStyle = color;
    context.fillRect(px + 2, py + 2, size - 4, size - 4);
    context.fillStyle = "rgba(255,255,255,0.4)";
    context.fillRect(px + 2, py + 2, size - 4, 3);
    context.fillRect(px + 2, py + 2, 3, size - 4);
    context.fillStyle = "rgba(0,0,0,0.08)";
    context.fillRect(px + 2, py + size - 5, size - 4, 3);
    context.fillRect(px + size - 5, py + 2, 3, size - 4);
  } else if (skin.style === "pixel") {
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    const n = 4;
    const cell = (size - 2) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        context.fillStyle =
          (i + j) % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.14)";
        context.fillRect(
          px + 1 + i * cell,
          py + 1 + j * cell,
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
    context.strokeStyle = "rgba(0,0,0,0.35)";
    context.lineWidth = 1;
    context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  } else {
    // retro / flat (estilo original)
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(px + 1, py + 1, size - 2, 4);
  }

  // marca de bomba: cuadrado interior oscuro (común a todos los skins)
  if (colorIndex === BOMB) {
    const inner = Math.round(size * 0.4);
    const off = Math.round((size - inner) / 2);
    context.fillStyle = "rgba(0,0,0,0.55)";
    context.fillRect(px + off, py + off, inner, inner);
  }

  context.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, skin: Skin) {
  ctx.strokeStyle = skin.grid ?? GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

// ── Contrato público ───────────────────────────────────────────────────────────
export interface TetrisSnapshot extends GameSnapshot {
  lines: number;
  level: number;
  combo: number; // se calcula igual que el original; no forma parte de `stats`
}

export interface TetrisHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  opts: {
    onState: (s: TetrisSnapshot) => void;
    skin: TetrisSkin;
    nextCanvas?: HTMLCanvasElement;
  }
): TetrisHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;
  const skin = SKINS[opts.skin] ?? SKINS.retro;

  // Estado de partida: encapsulado por completo dentro de la fábrica, para
  // permitir un reinicio limpio y, en teoría, dos instancias simultáneas.
  let board: Board;
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let combo: number;
  let maxCombo: number;
  let gameOver: boolean;
  let dropAccum: number;
  let dropInterval: number;

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let lastSnapshot: TetrisSnapshot | null = null;

  // Solo notifica al wrapper de React cuando cambia algo del snapshot.
  function emitState() {
    const snapshot: TetrisSnapshot = {
      score,
      over: gameOver,
      lines,
      level,
      combo,
      stats: [
        { l: "Líneas", v: String(lines) },
        { l: "Nivel", v: String(level) },
      ],
    };
    if (
      lastSnapshot &&
      lastSnapshot.score === snapshot.score &&
      lastSnapshot.lines === snapshot.lines &&
      lastSnapshot.level === snapshot.level &&
      lastSnapshot.combo === snapshot.combo &&
      lastSnapshot.over === snapshot.over
    ) {
      return;
    }
    lastSnapshot = snapshot;
    opts.onState(snapshot);
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    combo = 0;
    maxCombo = 0;
    gameOver = false;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    dropAccum = 0;
    current = randomPiece();
    next = randomPiece();
    emitState();
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, skin);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK, skin);

    const gy = ghostY(board, current);
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            skin,
            0.2
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
          skin
        );
  }

  // ── Bucle principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!gameOver) {
      dropAccum += dt * 1000;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(board, current.shape, current.x, current.y + 1)) {
          current.y++;
        }
        // El bloqueo de pieza (lockPiece) se añade en el siguiente paso del plan.
      }
    }
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
      gameOver = true;
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
