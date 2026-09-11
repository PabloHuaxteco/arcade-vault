// ===== lib/games/snake/engine.ts — motor de "serpentina" (snake), diseñado =====
// ===== desde cero a partir de references/source-assets/snake-assets/ =====
//
// Módulo de DOM puro: no importa nada de react ni de next/*. Todo el estado
// de una partida vive dentro de `createSnakeGame`; a nivel de módulo solo
// quedan constantes puras.

import type { GameSnapshot } from "@/lib/games/types";

const GAME_W = 800;
const GAME_H = 600;
const CELL = 40;
const COLS = GAME_W / CELL; // 20
const ROWS = GAME_H / CELL; // 15

const INITIAL_INTERVAL_MS = 150;
const SPEED_STEP_MS = 10;
const MIN_INTERVAL_MS = 60;
const FRUITS_PER_SPEEDUP = 5;
const BLINK_DURATION_MS = 400;
const FRUIT_POINTS = 10;

// ── Atlas de frutas, tipado a partir de references/source-assets/snake-assets/sprites.js ──
// Hoja: fruits.png, 3790x442px, fondo transparente. Fila usada: y=136-295 (160px de alto).
interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRUIT_ATLAS: Record<string, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

const FRUIT_TYPES = Object.keys(FRUIT_ATLAS);

const FRUITSHEET_SRC = "/games/snake/fruits.png";

interface Cell {
  x: number;
  y: number;
}

type Direction = "up" | "down" | "left" | "right";

const DIRECTION_DELTAS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

type Phase = "playing" | "dying" | "over";

interface Fruit {
  type: string;
  pos: Cell;
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// ── Contrato público ───────────────────────────────────────────────────────────
export interface SnakeSnapshot extends GameSnapshot {
  length: number; // segmentos de la serpiente, incluida la cabeza
  speedTier: number; // 1, 2, 3... sube cada FRUITS_PER_SPEEDUP frutas comidas
}

export interface SnakeHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: SnakeSnapshot) => void }
): SnakeHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Estado de partida: encapsulado por completo dentro de la fábrica, para
  // permitir un reinicio limpio y, en teoría, dos instancias simultáneas.
  let phase: Phase;
  let segments: Cell[];
  let direction: Direction;
  let pendingDirection: Direction;
  let fruit: Fruit;
  let tickAccumulator: number;
  let tickIntervalMs: number;
  let score: number;
  let fruitsEaten: number;
  let speedTier: number;
  let dyingElapsedMs: number;
  let paused: boolean;

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let lastSnapshot: SnakeSnapshot | null = null;

  // ── Spritesheet de frutas ────────────────────────────────────────────────────
  let sheet: HTMLImageElement | null = null;
  let sheetLoaded = false;

  function loadSpritesheet() {
    const img = new Image();
    img.onload = () => {
      sheet = img;
      sheetLoaded = true;
    };
    img.src = FRUITSHEET_SRC;
  }

  // ── Construcción de partida ────────────────────────────────────────────────
  function freeCells(): Cell[] {
    const occupied = new Set(segments.map((s) => `${s.x},${s.y}`));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    return free;
  }

  function spawnFruit() {
    const candidates = freeCells();
    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    fruit = { type, pos };
  }

  function initGame() {
    phase = "playing";
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    segments = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    direction = "right";
    pendingDirection = "right";
    tickAccumulator = 0;
    tickIntervalMs = INITIAL_INTERVAL_MS;
    score = 0;
    fruitsEaten = 0;
    speedTier = 1;
    dyingElapsedMs = 0;
    paused = false;
    spawnFruit();
    emitState();
  }

  // Solo notifica al wrapper de React cuando cambia score/length/speedTier/over.
  function emitState() {
    const snapshot: SnakeSnapshot = {
      score,
      over: phase === "over",
      length: segments.length,
      speedTier,
      stats: [
        { l: "Puntuación", v: String(score) },
        { l: "Longitud", v: String(segments.length) },
        { l: "Velocidad", v: `x${speedTier}` },
      ],
    };
    if (
      lastSnapshot &&
      lastSnapshot.score === snapshot.score &&
      lastSnapshot.length === snapshot.length &&
      lastSnapshot.speedTier === snapshot.speedTier &&
      lastSnapshot.over === snapshot.over
    ) {
      return;
    }
    lastSnapshot = snapshot;
    opts.onState(snapshot);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function setPendingDirection(dir: Direction) {
    if (OPPOSITE_DIRECTION[dir] === direction) return; // bloquea el giro de 180°
    pendingDirection = dir;
  }

  function handleKeyDown(e: KeyboardEvent) {
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir) return;
    const active = !paused && (phase === "playing" || phase === "dying");
    if (active) e.preventDefault();
    if (paused || phase !== "playing") return;
    setPendingDirection(dir);
  }

  // ── Tick de grid ─────────────────────────────────────────────────────────────
  function doTick() {
    direction = pendingDirection;
    const delta = DIRECTION_DELTAS[direction];
    const head = segments[0];
    const newHead: Cell = { x: head.x + delta.x, y: head.y + delta.y };

    const outOfBounds =
      newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS;
    const eating = newHead.x === fruit.pos.x && newHead.y === fruit.pos.y;
    const bodyToCheck = eating ? segments : segments.slice(0, -1);
    const hitsSelf = bodyToCheck.some(
      (s) => s.x === newHead.x && s.y === newHead.y
    );

    if (outOfBounds || hitsSelf) {
      phase = "dying";
      dyingElapsedMs = 0;
      emitState();
      return;
    }

    segments.unshift(newHead);
    if (eating) {
      score += FRUIT_POINTS;
      fruitsEaten += 1;
      if (fruitsEaten % FRUITS_PER_SPEEDUP === 0) {
        speedTier += 1;
        tickIntervalMs = Math.max(
          MIN_INTERVAL_MS,
          tickIntervalMs - SPEED_STEP_MS
        );
      }
      spawnFruit();
    } else {
      segments.pop();
    }
    emitState();
  }

  function update(dt: number) {
    if (phase === "over") return;

    if (phase === "dying") {
      dyingElapsedMs += dt * 1000;
      if (dyingElapsedMs >= BLINK_DURATION_MS) {
        phase = "over";
        emitState();
      }
      return;
    }

    tickAccumulator += dt * 1000;
    if (tickAccumulator >= tickIntervalMs) {
      doTick();
      tickAccumulator = 0;
    }
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function drawFruit() {
    const rect = FRUIT_ATLAS[fruit.type];
    const dx = fruit.pos.x * CELL;
    const dy = fruit.pos.y * CELL;
    if (sheetLoaded && sheet) {
      ctx.drawImage(sheet, rect.x, rect.y, rect.w, rect.h, dx, dy, CELL, CELL);
    }
  }

  function drawSnake() {
    const margin = 2;
    segments.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = phase === "dying" ? "#ff2d55" : "#39ff6a";
      if (phase === "dying") {
        const blinkOn = Math.floor(dyingElapsedMs / 100) % 2 === 0;
        ctx.fillStyle = blinkOn ? "#ff2d55" : "#0f2f16";
      } else {
        ctx.fillStyle = isHead ? "#9dffb0" : "#22c55e";
      }
      ctx.fillRect(
        seg.x * CELL + margin,
        seg.y * CELL + margin,
        CELL - margin * 2,
        CELL - margin * 2
      );
      ctx.restore();
    });
  }

  function draw() {
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    drawFruit();
    drawSnake();
  }

  // ── Bucle principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  loadSpritesheet();
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
