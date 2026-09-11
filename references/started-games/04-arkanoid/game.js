// game.js — MVP jugable de Arkanoid (SPEC 01)

const GAME_W = 800;
const GAME_H = 600;

// Niveles: cada string es una fila; cada carácter, un ladrillo o un hueco ('.').
// Colores válidos en spritesheet.js: gray red yellow cyan magenta hotpink green
// R red · Y yellow · G green · C cyan · M magenta · H hotpink · A gray · '.' hueco
const LEVELS = [
  {
    grid: [
      "RRRRRRRRRR",
      "YYYYYYYYYY",
      "GGGGGGGGGG",
      "CCCCCCCCCC",
    ],
    ballSpeed: 5,
  },
  {
    grid: [
      "MMMMMMMMMM",
      "H.HHHHHH.H",
      "CCCCCCCCCC",
      "G.GGGGGG.G",
      "YYYYYYYYYY",
    ],
    ballSpeed: 6,
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
    ballSpeed: 7,
  },
];
const COLOR_MAP = {
  R: "red", Y: "yellow", G: "green", C: "cyan",
  M: "magenta", H: "hotpink", A: "gray",
};

// Rutas de audio. Los ficheros ya existen en el repo.
const SOUNDS = {
  bounce: "assets/sounds/ball-bounce.mp3",
  break: "assets/sounds/break-sound.mp3",
};

// audio.bounce / audio.break: HTMLAudioElement precargado (se rellena en loadSounds()).
const audio = {};

const BRICK_H = 24;      // alto fijo de cada ladrillo
const BRICK_TOP = 60;    // margen superior de la rejilla

const state = {
  phase: "playing", // "playing" | "won" | "lost"
  level: 0,         // índice en LEVELS
  muted: false,
  paddle: { x: 0, y: 0, w: 96, h: 16, speed: 7 },
  ball: { x: 0, y: 0, r: 8, vx: 0, vy: 0, speed: 5, stuck: true },
  bricks: [/* { x, y, w, h, color, alive } */],
  explosions: [/* { x, y, w, h, color, start } */],
};

const keys = { left: false, right: false };

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Construye state.bricks a partir del grid del nivel actual y COLOR_MAP.
function buildBricks() {
  state.bricks = [];
  const grid = LEVELS[state.level].grid;
  const cols = grid[0].length;
  const cellW = GAME_W / cols;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const ch = grid[row][col];
      const color = COLOR_MAP[ch];
      if (!color) continue; // '.' u otro carácter = hueco
      state.bricks.push({
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
  const p = state.paddle;
  p.x = (GAME_W - p.w) / 2;
  p.y = GAME_H - 40;

  const b = state.ball;
  b.stuck = true;
  b.vx = 0;
  b.vy = 0;
  b.x = p.x + p.w / 2;
  b.y = p.y - b.r;
}

// --- Audio ---

// Precarga un HTMLAudioElement por sonido. Se llama dentro del callback de
// loadSpritesheet, cuando el resto de assets ya está listo.
function loadSounds() {
  for (const k in SOUNDS) {
    audio[k] = new Audio(SOUNDS[k]);
    audio[k].preload = "auto";
  }
}

// Reproduce un sonido si el juego no está silenciado. Clona el nodo para permitir
// solapes y traga el rechazo de la promesa (política de autoplay del navegador).
function playSound(name) {
  if (state.muted) return;
  const el = audio[name];
  if (!el) return;
  el.cloneNode().play().catch(() => {});
}

// Carga el nivel actual: reconstruye los ladrillos, ajusta la velocidad de la
// bola y la deja pegada a la paleta sin recolocar la paleta.
function loadLevel() {
  buildBricks();

  const b = state.ball;
  const p = state.paddle;
  b.speed = LEVELS[state.level].ballSpeed;
  b.stuck = true;
  b.vx = 0;
  b.vy = 0;
  b.x = p.x + p.w / 2;
  b.y = p.y - b.r;
}

// --- Control de la paleta ---

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = GAME_W / rect.width;
  const mouseX = (e.clientX - rect.left) * scaleX;
  state.paddle.x = mouseX - state.paddle.w / 2;
});

function setKey(e, down) {
  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      keys.left = down;
      break;
    case "ArrowRight":
    case "d":
    case "D":
      keys.right = down;
      break;
  }
}

window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));

// --- Lanzamiento de la bola ---

function launchBall() {
  const b = state.ball;
  if (!b.stuck) return;
  b.stuck = false;
  b.vx = 0;
  b.vy = -b.speed;
}

canvas.addEventListener("mousedown", launchBall);
window.addEventListener("keydown", (e) => {
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    launchBall();
  }
});

// --- Reinicio de la partida ---

function resetGame() {
  state.phase = "playing";
  state.level = 0;
  keys.left = false;
  keys.right = false;
  state.explosions = [];
  buildBricks();
  placePaddleAndBall();
}

window.addEventListener("keydown", (e) => {
  if ((e.key === "r" || e.key === "R") && state.phase !== "playing") {
    resetGame();
  }
});

// --- Mute (tecla M, en memoria, no se persiste) ---

window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") {
    state.muted = !state.muted;
  }
});

function clampPaddle() {
  const p = state.paddle;
  if (p.x < 0) p.x = 0;
  if (p.x > GAME_W - p.w) p.x = GAME_W - p.w;
}

function moveBall() {
  const b = state.ball;
  const p = state.paddle;

  if (b.stuck) {
    b.x = p.x + p.w / 2;
    b.y = p.y - b.r;
    return;
  }

  b.x += b.vx;
  b.y += b.vy;

  // Rebote contra las paredes laterales.
  if (b.x - b.r < 0) {
    b.x = b.r;
    b.vx = Math.abs(b.vx);
    playSound("bounce");
  } else if (b.x + b.r > GAME_W) {
    b.x = GAME_W - b.r;
    b.vx = -Math.abs(b.vx);
    playSound("bounce");
  }

  // Rebote contra el techo.
  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = Math.abs(b.vy);
    playSound("bounce");
  }
}

// AABB entre la bola (como caja de lado 2r) y la paleta.
function ballHitsPaddle() {
  const b = state.ball;
  const p = state.paddle;
  return (
    b.x + b.r > p.x &&
    b.x - b.r < p.x + p.w &&
    b.y + b.r > p.y &&
    b.y - b.r < p.y + p.h
  );
}

function ballPaddleCollision() {
  const b = state.ball;
  const p = state.paddle;

  // Solo cuenta si la bola va bajando, para no "pegarla" a la paleta.
  if (b.stuck || b.vy <= 0) return;
  if (!ballHitsPaddle()) return;

  // Reposicionar la bola justo encima de la paleta.
  b.y = p.y - b.r;

  // Offset del impacto respecto al centro de la paleta, normalizado a [-1, 1].
  let offset = (b.x - (p.x + p.w / 2)) / (p.w / 2);
  offset = Math.max(-1, Math.min(1, offset));

  const MAX_ANGLE = Math.PI / 3; // 60° respecto a la vertical
  const angle = offset * MAX_ANGLE;
  b.vx = b.speed * Math.sin(angle);
  b.vy = -b.speed * Math.cos(angle);

  // Forzar vy negativo con módulo mínimo (evita trayectorias casi horizontales).
  const MIN_VY = b.speed * 0.35;
  if (b.vy > -MIN_VY) b.vy = -MIN_VY;

  playSound("bounce");
}

// Colisión bola-ladrillo: un ladrillo por frame como máximo.
function ballBrickCollision(now) {
  const b = state.ball;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;

    const hit =
      b.x + b.r > brick.x &&
      b.x - b.r < brick.x + brick.w &&
      b.y + b.r > brick.y &&
      b.y - b.r < brick.y + brick.h;
    if (!hit) continue;

    brick.alive = false;
    playSound("break");

    state.explosions.push({
      x: brick.x,
      y: brick.y,
      w: brick.w,
      h: brick.h,
      color: brick.color,
      start: now,
    });

    // Lado de impacto según el solapamiento mínimo en cada eje.
    const overlapX = Math.min(
      b.x + b.r - brick.x,
      brick.x + brick.w - (b.x - b.r)
    );
    const overlapY = Math.min(
      b.y + b.r - brick.y,
      brick.y + brick.h - (b.y - b.r)
    );
    if (overlapX < overlapY) {
      b.vx = -b.vx;
    } else {
      b.vy = -b.vy;
    }

    break; // solo un ladrillo por frame
  }
}

// Avanza al siguiente nivel si no estamos en el último.
function advanceLevel() {
  if (state.level < LEVELS.length - 1) {
    state.level++;
    loadLevel();
  }
}

function checkPhase() {
  const b = state.ball;

  // Derrota: la bola cruza el borde inferior del canvas.
  if (b.y - b.r > GAME_H) {
    state.phase = "lost";
    return;
  }

  // Nivel limpio: no queda ningún ladrillo vivo y ninguna explosión en curso,
  // para que se vea romperse el último ladrillo antes de avanzar.
  if (
    state.bricks.every((brick) => !brick.alive) &&
    state.explosions.length === 0
  ) {
    if (state.level === LEVELS.length - 1) {
      state.phase = "won";
    } else {
      advanceLevel();
    }
  }
}

function update(now) {
  if (state.phase !== "playing") return; // simulación congelada

  // Purgar explosiones ya terminadas (>= EXPLOSION_DURATION).
  state.explosions = state.explosions.filter(
    (e) => now - e.start < EXPLOSION_DURATION
  );

  const p = state.paddle;
  if (keys.left) p.x -= p.speed;
  if (keys.right) p.x += p.speed;
  clampPaddle();

  moveBall();
  ballPaddleCollision();
  ballBrickCollision(now);
  checkPhase();
}

function render(now) {
  ctx.clearRect(0, 0, GAME_W, GAME_H);

  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    drawSprite(ctx, "block_" + brick.color, brick.x, brick.y, brick.w, brick.h);
  }

  const frameDuration = EXPLOSION_DURATION / 4;
  for (const e of state.explosions) {
    let idx = Math.floor((now - e.start) / frameDuration);
    idx = Math.max(0, Math.min(3, idx));
    drawFrame(ctx, EXPLOSION_FRAMES[e.color][idx], e.x, e.y, e.w, e.h);
  }

  const p = state.paddle;
  drawSprite(ctx, "paddle", p.x, p.y, p.w, p.h);

  const b = state.ball;
  drawSprite(ctx, "ball", b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);

  drawHUD();

  if (state.phase !== "playing") {
    drawOverlay(state.phase === "won" ? "GANASTE" : "PERDISTE");
  }
}

// HUD: número de nivel arriba a la izquierda e indicador MUTE arriba a la derecha.
function drawHUD() {
  ctx.fillStyle = "#fff";
  ctx.font = "16px sans-serif";
  ctx.textBaseline = "top";

  ctx.textAlign = "left";
  ctx.fillText("Nivel " + (state.level + 1), 8, 8);

  if (state.muted) {
    ctx.textAlign = "right";
    ctx.fillText("MUTE", GAME_W - 8, 8);
  }
}

function drawOverlay(text) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 64px sans-serif";
  ctx.fillText(text, GAME_W / 2, GAME_H / 2 - 20);

  ctx.font = "24px sans-serif";
  ctx.fillText("Pulsa R para reiniciar", GAME_W / 2, GAME_H / 2 + 40);
}

function frame(now) {
  update(now);
  render(now);
  requestAnimationFrame(frame);
}

loadSpritesheet(() => {
  loadSounds();
  buildBricks();
  placePaddleAndBall();
  requestAnimationFrame(frame);
});
