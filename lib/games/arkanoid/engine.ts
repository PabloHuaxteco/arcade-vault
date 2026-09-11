// ===== lib/games/arkanoid/engine.ts — motor de "bloque-buster" (arkanoid), =====
// ===== portado de references/started-games/04-arkanoid/game.js =====
//
// Módulo de DOM puro: no importa nada de react ni de next/*. Todo el estado
// de una partida vive dentro de `createArkanoidGame`; a nivel de módulo solo
// quedan constantes puras.

import type { GameSnapshot } from "@/lib/games/types";

const GAME_W = 800;
const GAME_H = 600;

// Niveles: cada string es una fila; cada carácter, un ladrillo o un hueco ('.').
// ballSpeed ya convertido de px/frame (5/6/7 en el original) a px/segundo (×60).
const LEVELS: { grid: string[]; ballSpeed: number }[] = [
  {
    grid: ["RRRRRRRRRR", "YYYYYYYYYY", "GGGGGGGGGG", "CCCCCCCCCC"],
    ballSpeed: 300,
  },
  {
    grid: [
      "MMMMMMMMMM",
      "H.HHHHHH.H",
      "CCCCCCCCCC",
      "G.GGGGGG.G",
      "YYYYYYYYYY",
    ],
    ballSpeed: 360,
  },
  {
    grid: [
      "AAAAAAAAAA",
      "MM.MMMM.MM",
      "HH.HHHH.HH",
      "CC.CCCC.CC",
      "GG.GGGG.GG",
      ".RRRRRRRR.",
    ],
    ballSpeed: 420,
  },
];

const COLOR_MAP: Record<string, string> = {
  R: "red",
  Y: "yellow",
  G: "green",
  C: "cyan",
  M: "magenta",
  H: "hotpink",
  A: "gray",
};

const BRICK_H = 24; // alto fijo de cada ladrillo
const BRICK_TOP = 60; // margen superior de la rejilla
const BRICK_SCORE = 10; // puntos fijos por ladrillo roto (no existe en el original)

const EXPLOSION_DURATION = 150; // ms

interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const EXPLOSION_FRAMES: Record<string, SpriteRect[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const SPRITES: {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<string, SpriteRect>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

const SPRITESHEET_SRC = "/games/arkanoid/spritesheet-breakout.png";

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number; // px/segundo
}

interface Ball {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  speed: number; // px/segundo
  stuck: boolean;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  start: number; // ms (performance.now() relativo al bucle)
}

type Phase = "playing" | "won" | "lost";

// ── Contrato público ───────────────────────────────────────────────────────────
export interface ArkanoidSnapshot extends GameSnapshot {
  level: number; // 1-indexado para el HUD
}

export interface ArkanoidHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  destroy(): void;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: ArkanoidSnapshot) => void }
): ArkanoidHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Estado de partida: encapsulado por completo dentro de la fábrica, para
  // permitir un reinicio limpio y, en teoría, dos instancias simultáneas.
  let phase: Phase;
  let level: number;
  let score: number;
  let paddle: Paddle;
  let ball: Ball;
  let bricks: Brick[];
  let explosions: Explosion[];

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let lastSnapshot: ArkanoidSnapshot | null = null;

  const keys: { left: boolean; right: boolean } = { left: false, right: false };
  const CONTROL_CODES = ["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"];

  // ── Spritesheet ──────────────────────────────────────────────────────────────
  let sheet: HTMLImageElement | null = null;
  let sheetLoaded = false;

  function loadSpritesheet() {
    const img = new Image();
    img.onload = () => {
      sheet = img;
      sheetLoaded = true;
    };
    img.src = SPRITESHEET_SRC;
  }

  function drawSprite(
    rect: SpriteRect,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    if (!sheetLoaded || !sheet) return;
    ctx.drawImage(sheet, rect.sx, rect.sy, rect.sw, rect.sh, x, y, w, h);
  }

  // ── Construcción de nivel/partida ─────────────────────────────────────────────
  function buildBricks() {
    bricks = [];
    const grid = LEVELS[level].grid;
    const cols = grid[0].length;
    const cellW = GAME_W / cols;
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const ch = grid[row][col];
        const color = COLOR_MAP[ch];
        if (!color) continue; // '.' u otro carácter = hueco
        bricks.push({
          x: col * cellW,
          y: BRICK_TOP + row * BRICK_H,
          w: cellW,
          h: BRICK_H,
          color,
          alive: true,
        });
      }
    }
  }

  // Coloca la paleta abajo centrada y la bola pegada encima.
  function placePaddleAndBall() {
    paddle.x = (GAME_W - paddle.w) / 2;
    paddle.y = GAME_H - 40;

    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r;
  }

  // Carga el nivel actual: reconstruye los ladrillos, ajusta la velocidad de la
  // bola y la deja pegada a la paleta sin recolocar la paleta.
  function loadLevel() {
    buildBricks();
    ball.speed = LEVELS[level].ballSpeed;
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r;
  }

  function initGame() {
    phase = "playing";
    level = 0;
    score = 0;
    paddle = { x: 0, y: 0, w: 96, h: 16, speed: 420 };
    ball = {
      x: 0,
      y: 0,
      r: 8,
      vx: 0,
      vy: 0,
      speed: LEVELS[0].ballSpeed,
      stuck: true,
    };
    explosions = [];
    buildBricks();
    placePaddleAndBall();
    emitState();
  }

  // Solo notifica al wrapper de React cuando cambia score/level/over.
  function emitState() {
    const snapshot: ArkanoidSnapshot = {
      score,
      over: phase !== "playing",
      level: level + 1,
      stats: [
        { l: "Puntuación", v: String(score) },
        { l: "Nivel", v: String(level + 1) },
      ],
    };
    if (
      lastSnapshot &&
      lastSnapshot.score === snapshot.score &&
      lastSnapshot.level === snapshot.level &&
      lastSnapshot.over === snapshot.over
    ) {
      return;
    }
    lastSnapshot = snapshot;
    opts.onState(snapshot);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function setKey(code: string, down: boolean) {
    if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
    else if (code === "ArrowRight" || code === "KeyD") keys.right = down;
  }

  function launchBall() {
    if (!ball.stuck) return;
    ball.stuck = false;
    ball.vx = 0;
    ball.vy = -ball.speed;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (phase === "playing" && CONTROL_CODES.includes(e.code)) {
      e.preventDefault();
    }
    setKey(e.code, true);
    if (e.code === "Space") launchBall();
  }

  function handleKeyUp(e: KeyboardEvent) {
    setKey(e.code, false);
  }

  // ── Física ─────────────────────────────────────────────────────────────────
  function clampPaddle() {
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x > GAME_W - paddle.w) paddle.x = GAME_W - paddle.w;
  }

  function moveBall(dt: number) {
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r;
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r > GAME_W) {
      ball.x = GAME_W - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }
  }

  function ballHitsPaddle() {
    return (
      ball.x + ball.r > paddle.x &&
      ball.x - ball.r < paddle.x + paddle.w &&
      ball.y + ball.r > paddle.y &&
      ball.y - ball.r < paddle.y + paddle.h
    );
  }

  function ballPaddleCollision() {
    if (ball.stuck || ball.vy <= 0) return;
    if (!ballHitsPaddle()) return;

    ball.y = paddle.y - ball.r;

    let offset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    offset = Math.max(-1, Math.min(1, offset));

    const MAX_ANGLE = Math.PI / 3; // 60° respecto a la vertical
    const angle = offset * MAX_ANGLE;
    ball.vx = ball.speed * Math.sin(angle);
    ball.vy = -ball.speed * Math.cos(angle);

    const MIN_VY = ball.speed * 0.35;
    if (ball.vy > -MIN_VY) ball.vy = -MIN_VY;
  }

  // Colisión bola-ladrillo: un ladrillo por frame como máximo.
  function ballBrickCollision(now: number) {
    for (const brick of bricks) {
      if (!brick.alive) continue;

      const hit =
        ball.x + ball.r > brick.x &&
        ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y &&
        ball.y - ball.r < brick.y + brick.h;
      if (!hit) continue;

      brick.alive = false;
      score += BRICK_SCORE;

      explosions.push({
        x: brick.x,
        y: brick.y,
        w: brick.w,
        h: brick.h,
        color: brick.color,
        start: now,
      });

      const overlapX = Math.min(
        ball.x + ball.r - brick.x,
        brick.x + brick.w - (ball.x - ball.r)
      );
      const overlapY = Math.min(
        ball.y + ball.r - brick.y,
        brick.y + brick.h - (ball.y - ball.r)
      );
      if (overlapX < overlapY) {
        ball.vx = -ball.vx;
      } else {
        ball.vy = -ball.vy;
      }

      break; // solo un ladrillo por frame
    }
  }

  function advanceLevel() {
    if (level < LEVELS.length - 1) {
      level++;
      loadLevel();
    }
  }

  function checkPhase() {
    // Derrota: la bola cruza el borde inferior del canvas.
    if (ball.y - ball.r > GAME_H) {
      phase = "lost";
      return;
    }

    // Nivel limpio: no queda ningún ladrillo vivo y ninguna explosión en
    // curso, para que se vea romperse el último ladrillo antes de avanzar.
    if (bricks.every((brick) => !brick.alive) && explosions.length === 0) {
      if (level === LEVELS.length - 1) {
        phase = "won";
      } else {
        advanceLevel();
      }
    }
  }

  function update(dt: number, now: number) {
    if (phase !== "playing") return;

    explosions = explosions.filter((e) => now - e.start < EXPLOSION_DURATION);

    if (keys.left) paddle.x -= paddle.speed * dt;
    if (keys.right) paddle.x += paddle.speed * dt;
    clampPaddle();

    moveBall(dt);
    ballPaddleCollision();
    ballBrickCollision(now);
    checkPhase();
    emitState();
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function draw(now: number) {
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    for (const brick of bricks) {
      if (!brick.alive) continue;
      const rect = SPRITES.blocks[brick.color];
      if (rect) drawSprite(rect, brick.x, brick.y, brick.w, brick.h);
    }

    const frameDuration = EXPLOSION_DURATION / 4;
    for (const explosion of explosions) {
      let idx = Math.floor((now - explosion.start) / frameDuration);
      idx = Math.max(0, Math.min(3, idx));
      const frames = EXPLOSION_FRAMES[explosion.color];
      if (frames) {
        drawSprite(
          frames[idx],
          explosion.x,
          explosion.y,
          explosion.w,
          explosion.h
        );
      }
    }

    drawSprite(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(
      SPRITES.ball,
      ball.x - ball.r,
      ball.y - ball.r,
      ball.r * 2,
      ball.r * 2
    );
  }

  // ── Bucle principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt, ts);
    draw(ts);
    rafId = requestAnimationFrame(loop);
  }

  loadSpritesheet();
  initGame();

  return {
    start() {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
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
      phase = "lost";
      emitState();
    },
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
