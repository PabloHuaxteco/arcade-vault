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

// ── Skins ─────────────────────────────────────────────────────────────────────
// Tres paletas verificadas contra el #000 real de .game-canvas (ratio WCAG
// ≥ 4.5:1). `clasico` congela el aspecto vigente del juego sin alterar un solo
// dígito; `retro` es fósforo ámbar plano de bordes duros; `neon` es alto
// contraste con glow del propio trazo y brillo interior.
export type SnakeSkin = "clasico" | "retro" | "neon";

// Recoloreado del spritesheet de frutas: se compone una vez por skin sobre un
// canvas offscreen (nunca por frame) y se cachea. `filter` aplana la hoja a gris
// con el suelo de luminancia necesario para superar 4.5:1 tras el multiply.
interface FruitTint {
  color: string;
  filter: string;
}

interface Skin {
  style: "flat" | "neon";
  glow: number; // shadowBlur en px; 0 = sin sombra, bordes duros
  fruitTint: FruitTint | null; // null = spritesheet original, sin tocar
  colors: {
    head: string;
    body: string;
    edge: string | null; // contorno duro del segmento; null = sin contorno
    deathOn: string; // fotograma encendido del parpadeo de muerte
    deathOff: string; // fotograma apagado (por diseño, por debajo del umbral)
    glowAlive: string | null; // null = el glow toma el color del propio trazo
    glowDead: string | null;
  };
}

const SKINS: Record<SnakeSkin, Skin> = {
  // Valores calcados del motor original, sin alterar un solo dígito.
  clasico: {
    style: "flat",
    glow: 12,
    fruitTint: null,
    colors: {
      head: "#9dffb0",
      body: "#22c55e",
      edge: null,
      deathOn: "#ff2d55",
      deathOff: "#0f2f16",
      glowAlive: "#39ff6a",
      glowDead: "#ff2d55",
    },
  },
  // Fósforo ámbar: cuatro tonos de una misma familia, sin shadowBlur y con
  // contorno duro que separa los segmentos como un CRT monocromo.
  retro: {
    style: "flat",
    glow: 0,
    fruitTint: {
      color: "#ffb000",
      filter: "grayscale(1) contrast(0.35) brightness(2.1)",
    },
    colors: {
      head: "#ffe3a3",
      body: "#f5a623",
      edge: "#c07a12",
      deathOn: "#ff7a18",
      deathOff: "#5a2c00",
      glowAlive: null,
      glowDead: null,
    },
  },
  // Alto contraste sobre negro: cabeza cian, cuerpo magenta, fruta lima. El
  // glow nunca sustituye al relleno — con shadowBlur 0 la forma sigue leyéndose.
  neon: {
    style: "neon",
    glow: 14,
    fruitTint: {
      color: "#f7ff4d",
      filter: "grayscale(1) contrast(0.5) brightness(2)",
    },
    colors: {
      head: "#66fff5",
      body: "#ff2fb3",
      edge: null,
      deathOn: "#ff5e5e",
      deathOff: "#320a24",
      glowAlive: null, // usa el color del propio segmento
      glowDead: null,
    },
  },
};

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
  /** Cambia la paleta en caliente, sin destruir la partida en curso. */
  setSkin(skin: SnakeSkin): void;
  destroy(): void;
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: SnakeSnapshot) => void; skin?: SnakeSkin }
): SnakeHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Paleta activa: si falta o no se reconoce el valor, cae en `clasico`.
  let skinName: SnakeSkin =
    opts.skin && SKINS[opts.skin] ? opts.skin : "clasico";
  let skin: Skin = SKINS[skinName];

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

  // Hojas recoloreadas por skin: se construyen una sola vez, bajo demanda, y
  // nunca dentro del bucle de dibujo.
  const tintedSheets = new Map<SnakeSkin, CanvasImageSource>();

  function loadSpritesheet() {
    const img = new Image();
    img.onload = () => {
      sheet = img;
      sheetLoaded = true;
      tintedSheets.clear();
    };
    img.src = FRUITSHEET_SRC;
  }

  // Recolorea la hoja de frutas al tono del skin: gris con suelo de luminancia
  // (ctx.filter) + multiply del tono + destination-in para recuperar el alfa
  // original. Si el navegador no soporta ctx.filter, cae en la hoja sin tocar.
  function buildTintedSheet(
    img: HTMLImageElement,
    tint: FruitTint
  ): CanvasImageSource {
    const off = document.createElement("canvas");
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const octx = off.getContext("2d");
    if (!octx || !("filter" in octx)) return img;
    octx.filter = tint.filter;
    octx.drawImage(img, 0, 0);
    octx.filter = "none";
    octx.globalCompositeOperation = "multiply";
    octx.fillStyle = tint.color;
    octx.fillRect(0, 0, off.width, off.height);
    octx.globalCompositeOperation = "destination-in";
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = "source-over";
    return off;
  }

  function fruitSource(): CanvasImageSource | null {
    if (!sheetLoaded || !sheet) return null;
    const tint = skin.fruitTint;
    if (!tint) return sheet;
    const cached = tintedSheets.get(skinName);
    if (cached) return cached;
    const built = buildTintedSheet(sheet, tint);
    tintedSheets.set(skinName, built);
    return built;
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
    const source = fruitSource();
    if (!source) return;
    const rect = FRUIT_ATLAS[fruit.type];
    const dx = fruit.pos.x * CELL;
    const dy = fruit.pos.y * CELL;
    ctx.save();
    if (skin.style === "neon" && skin.fruitTint) {
      ctx.shadowBlur = skin.glow;
      ctx.shadowColor = skin.fruitTint.color;
    }
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, dx, dy, CELL, CELL);
    ctx.restore();
  }

  function drawSnake() {
    const margin = 2;
    const c = skin.colors;
    const dying = phase === "dying";
    const blinkOn = Math.floor(dyingElapsedMs / 100) % 2 === 0;
    const size = CELL - margin * 2;

    segments.forEach((seg, i) => {
      const isHead = i === 0;
      const fill = dying
        ? blinkOn
          ? c.deathOn
          : c.deathOff
        : isHead
          ? c.head
          : c.body;
      const x = seg.x * CELL + margin;
      const y = seg.y * CELL + margin;

      ctx.save();
      if (skin.glow > 0) {
        ctx.shadowBlur = skin.glow;
        // En `neon` el glow sale del propio trazo; en `clasico`, de un color fijo.
        ctx.shadowColor = dying ? (c.glowDead ?? fill) : (c.glowAlive ?? fill);
      }
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, size, size);
      ctx.restore();

      // Bordes duros del fósforo CRT: contorno plano, nunca sombra.
      if (c.edge) {
        ctx.save();
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
        ctx.restore();
      }

      // Brillo interior del skin neon: se compone sobre el relleno, así que la
      // forma se sigue leyendo aunque shadowBlur sea 0.
      if (skin.style === "neon" && !dying) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(x + size * 0.3, y + size * 0.3, size * 0.4, size * 0.4);
        ctx.restore();
      }
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
    // Reemplaza la paleta en caliente: el siguiente frame ya se pinta con el
    // skin nuevo y la partida en curso sigue intacta.
    setSkin(next: SnakeSkin) {
      skinName = SKINS[next] ? next : "clasico";
      skin = SKINS[skinName];
      // En pausa no hay bucle que repinte: refresca el frame actual a mano.
      if (rafId === null) draw();
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
