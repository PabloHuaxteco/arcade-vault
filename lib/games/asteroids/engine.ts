// ===== lib/games/asteroids/engine.ts — motor de "rocas", portado de =====
// ===== references/started-games/02-asteroids/game.js =====
//
// Módulo de DOM puro: no importa nada de react ni de next/*. Todo el estado
// de una partida vive dentro de `createAsteroidsGame`; a nivel de módulo solo
// quedan constantes y utilidades puras.

const W = 800;
const H = 600;

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Skins ─────────────────────────────────────────────────────────────────────
// Tres paletas verificadas contra el #000 real de .game-canvas (ratio WCAG
// ≥ 4.5:1). `clasico` congela el aspecto vectorial blanco original; `retro` es
// fósforo ámbar plano; `neon` añade glow sin renunciar al trazo sólido.
export type AsteroidsSkin = "clasico" | "retro" | "neon";

interface SkinColors {
  ship: string;
  bullet: string;
  asteroid: string;
  particle: string; // base "r, g, b": la estela se desvanece con alpha
  thruster: string; // rgba() completo (alpha fija)
  shieldRing: string; // base "r, g, b": el anillo pulsa con alpha
  triple: string;
  shield: string;
  core: string; // línea interior del tubo neón (sin efecto en `flat`)
}

interface Skin {
  style: "flat" | "neon";
  glow: number; // shadowBlur en px; 0 en los skins planos
  colors: SkinColors;
}

const SKINS: Record<AsteroidsSkin, Skin> = {
  // Valores calcados del motor original, sin alterar un solo dígito.
  clasico: {
    style: "flat",
    glow: 0,
    colors: {
      ship: "#fff",
      bullet: "#fff",
      asteroid: "#fff",
      particle: "255,255,255",
      thruster: "rgba(255, 130, 0, 0.85)",
      shieldRing: "67, 224, 160",
      triple: "#3ba7ff",
      shield: "#43e0a0",
      core: "#fff",
    },
  },
  // Fósforo ámbar: cinco tonos de la misma familia, formas planas, bordes duros.
  retro: {
    style: "flat",
    glow: 0,
    colors: {
      ship: "#ffdf9e",
      bullet: "#fff2cf",
      asteroid: "#f0a92e",
      particle: "255,190,85",
      thruster: "rgba(255, 143, 31, 0.85)",
      shieldRing: "255, 207, 107",
      triple: "#fff2cf",
      shield: "#ffbe55",
      core: "#ffdf9e",
    },
  },
  // Alto contraste sobre negro: saturación alta + glow del propio trazo.
  neon: {
    style: "neon",
    glow: 12,
    colors: {
      ship: "#00f5ff",
      bullet: "#ffe600",
      asteroid: "#ff2fb3",
      particle: "255,138,61",
      thruster: "rgba(255, 106, 0, 0.9)",
      shieldRing: "57, 255, 176",
      triple: "#4db8ff",
      shield: "#39ffb0",
      core: "#ffffff",
    },
  },
};

// Traza el path actual. En `neon` pinta el halo y encima un núcleo claro más
// fino: la silueta sigue leyéndose aunque shadowBlur valga 0.
function strokePath(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  width = 1.5
) {
  ctx.strokeStyle = color;
  if (skin.style === "neon") {
    ctx.lineWidth = width + 0.7;
    ctx.shadowColor = color;
    ctx.shadowBlur = skin.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = skin.colors.core;
    ctx.lineWidth = Math.max(0.7, width - 0.7);
    ctx.stroke();
  } else {
    ctx.lineWidth = width;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }
}

// Rellena el path actual. El segundo `fill()` garantiza el relleno opaco: el
// glow nunca sustituye a la forma.
function fillPath(ctx: CanvasRenderingContext2D, skin: Skin, color: string) {
  ctx.fillStyle = color;
  if (skin.style === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = skin.glow;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fill();
}

// ── Bullet ────────────────────────────────────────────────────────────────────
const BULLET_SPEED = 520;
const BULLET_TTL = 1.1;
const BULLET_RADIUS = 2;

class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * BULLET_SPEED;
    this.vy = Math.sin(angle) * BULLET_SPEED;
    this.ttl = BULLET_TTL;
    this.radius = BULLET_RADIUS;
    this.dead = false;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    fillPath(ctx, skin, skin.colors.bullet);
    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead: boolean;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    strokePath(ctx, skin, skin.colors.asteroid);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
const SHIP_ROT_SPEED = 3.5; // rad/s
const SHIP_THRUST = 260; // px/s²
const SHIP_DRAG = 0.987;
const SHIP_SHOOT_COOLDOWN = 0.2;
const SHIP_NOSE = 21;
const SHIP_TRIPLE_SPREAD = 0.22;

class Ship {
  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 0;
  shootCooldown = 0;
  dead = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    if (keys["ArrowLeft"]) this.angle -= SHIP_ROT_SPEED * dt;
    if (keys["ArrowRight"]) this.angle += SHIP_ROT_SPEED * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
      this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
    }

    this.vx *= SHIP_DRAG;
    this.vy *= SHIP_DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(tripleShotActive: boolean): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = SHIP_SHOOT_COOLDOWN;
    const ox = this.x + Math.cos(this.angle) * SHIP_NOSE;
    const oy = this.y + Math.sin(this.angle) * SHIP_NOSE;

    if (tripleShotActive) {
      return [
        new Bullet(ox, oy, this.angle - SHIP_TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SHIP_TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin, shieldTimer: number) {
    if (this.dead) return;

    if (
      shieldTimer > 0 &&
      !(shieldTimer < 1.5 && Math.floor(shieldTimer * 8) % 2 === 0)
    ) {
      const alpha = 0.55 + 0.25 * Math.sin(performance.now() / 120);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      strokePath(
        ctx,
        skin,
        `rgba(${skin.colors.shieldRing}, ${alpha.toFixed(2)})`
      );
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    strokePath(ctx, skin, skin.colors.ship);

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      strokePath(ctx, skin, skin.colors.thruster);
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.dead = false;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin) {
    const alpha = this.ttl / this.life;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    strokePath(
      ctx,
      skin,
      `rgba(${skin.colors.particle},${alpha.toFixed(2)})`,
      1
    );
    ctx.restore();
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
// El color de cada power-up vive en SKINS (`colors.triple` / `colors.shield`),
// indexado por este mismo nombre de tipo.
const POWERUP_TYPES = {
  triple: { label: "TRIPLE" },
  shield: { label: "ESCUDO" },
} as const;

type PowerUpType = keyof typeof POWERUP_TYPES;

class PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  vx: number;
  vy: number;
  radius: number;
  rot: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number, type: PowerUpType) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = rand(-25, 25);
    this.vy = rand(-25, 25);
    this.radius = 11;
    this.rot = 0;
    this.ttl = 12;
    this.dead = false;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += 1.4 * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin) {
    if (this.ttl < 3 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const color = skin.colors[this.type];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.lineJoin = "round";

    // Rombo contenedor
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius, 0);
    ctx.closePath();
    strokePath(ctx, skin, color);

    if (this.type === "triple") {
      // Tres líneas en abanico, símbolo del disparo triple
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(-5, -5);
      ctx.moveTo(0, 3);
      ctx.lineTo(0, -6);
      ctx.moveTo(0, 3);
      ctx.lineTo(5, -5);
      strokePath(ctx, skin, color);
    } else if (this.type === "shield") {
      // Núcleo con un arco de energía, símbolo del escudo
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      strokePath(ctx, skin, color);
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, -Math.PI * 0.7, Math.PI * 0.5);
      strokePath(ctx, skin, color);
    }

    ctx.restore();
  }
}

// ── Contrato público ──────────────────────────────────────────────────────────
export interface AsteroidsSnapshot {
  score: number;
  lives: number;
  level: number;
  over: boolean; // true cuando el estado interno es 'gameover'
}

export interface AsteroidsHandle {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  /** Cambia la paleta en caliente, sin destruir la partida en curso. */
  setSkin(skin: AsteroidsSkin): void;
  destroy(): void;
}

type GameState = "playing" | "dead" | "gameover";

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  opts: { onState: (s: AsteroidsSnapshot) => void; skin?: AsteroidsSkin }
): AsteroidsHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Paleta activa: si falta o no se reconoce el valor, cae en `clasico`.
  let skin: Skin = (opts.skin && SKINS[opts.skin]) ?? SKINS.clasico;

  // Estado de partida: encapsulado por completo dentro de la fábrica, para
  // permitir un reinicio limpio y, en teoría, dos instancias simultáneas.
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  const CONTROL_CODES = [
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];

  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: GameState;
  let deadTimer: number;
  let powerUpSpawned: Record<PowerUpType, boolean>;
  let tripleShotTimer: number;
  let shieldTimer: number;

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let lastSnapshot: AsteroidsSnapshot | null = null;

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  function handleKeyDown(e: KeyboardEvent) {
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    // Solo bloquea el scroll de la página mientras la partida está activa;
    // nunca en pausa ni en 'gameover'.
    if (
      (state === "playing" || state === "dead") &&
      CONTROL_CODES.includes(e.code)
    ) {
      e.preventDefault();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    powerUpSpawned = { triple: false, shield: false };
    tripleShotTimer = 0;
    shieldTimer = 0;
    spawnAsteroids(4);
    emitState();
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUpSpawned = { triple: false, shield: false };
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    tripleShotTimer = 0;
    shieldTimer = 0;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // Solo notifica al wrapper de React cuando cambia algo del snapshot.
  function emitState() {
    const snapshot: AsteroidsSnapshot = {
      score,
      lives,
      level,
      over: state === "gameover",
    };
    if (
      lastSnapshot &&
      lastSnapshot.score === snapshot.score &&
      lastSnapshot.lives === snapshot.lives &&
      lastSnapshot.level === snapshot.level &&
      lastSnapshot.over === snapshot.over
    ) {
      return;
    }
    lastSnapshot = snapshot;
    opts.onState(snapshot);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      powerUps.forEach((p) => p.update(dt));
      powerUps = powerUps.filter((p) => !p.dead);
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot(tripleShotTimer > 0));
    }

    if (tripleShotTimer > 0) tripleShotTimer -= dt;
    if (shieldTimer > 0) shieldTimer -= dt;

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          const availableTypes = (
            Object.keys(POWERUP_TYPES) as PowerUpType[]
          ).filter((t) => !powerUpSpawned[t]);
          if (availableTypes.length > 0 && Math.random() < 0.15) {
            const type = availableTypes[randInt(0, availableTypes.length - 1)];
            powerUpSpawned[type] = true;
            powerUps.push(new PowerUp(a.x, a.y, type));
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs power-up
    if (!ship.dead) {
      for (const p of powerUps) {
        if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
          p.dead = true;
          if (p.type === "triple") tripleShotTimer = 5;
          else if (p.type === "shield") shieldTimer = 5;
          explode(p.x, p.y, 6);
        }
      }
      powerUps = powerUps.filter((p) => !p.dead);
    }

    // Nave vs asteroide
    if (ship.invincible <= 0 && !ship.dead) {
      const shieldedFragments: Asteroid[] = [];
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (shieldTimer > 0) {
            shieldTimer = 0;
            a.dead = true;
            explode(a.x, a.y, a.size * 5);
            shieldedFragments.push(...a.split());
            ship.invincible = 1;
          } else {
            killShip();
          }
          break;
        }
      }
      if (shieldedFragments.length > 0)
        asteroids = asteroids.filter((a) => !a.dead).concat(shieldedFragments);
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();

    emitState();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // El HUD de texto (SCORE/NIVEL/vidas) y el overlay de GAME OVER del original
  // se retiran: los alimenta la barra .player-hud de React. Se conserva solo
  // el dibujo de los temporizadores de power-up activos.
  function drawTimerLabel(text: string, color: string, y: number) {
    ctx.fillStyle = color;
    if (skin.style === "neon") {
      ctx.shadowColor = color;
      ctx.shadowBlur = skin.glow;
      ctx.fillText(text, 14, y);
      ctx.shadowBlur = 0;
    }
    ctx.fillText(text, 14, y);
  }

  function drawPowerUpTimers() {
    let y = 24;
    ctx.save();
    ctx.textAlign = "left";
    ctx.font = "15px monospace";
    if (tripleShotTimer > 0) {
      drawTimerLabel(
        `TRIPLE ${Math.ceil(tripleShotTimer)}s`,
        skin.colors.triple,
        y
      );
      y += 20;
    }
    if (shieldTimer > 0) {
      drawTimerLabel(
        `ESCUDO ${Math.ceil(shieldTimer)}s`,
        skin.colors.shield,
        y
      );
      y += 20;
    }
    ctx.restore();
  }

  function draw() {
    // El fondo se mantiene en #000 en los tres skins: es la referencia real
    // contra la que se verificó el contraste de cada paleta.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx, skin));
    powerUps.forEach((p) => p.draw(ctx, skin));
    asteroids.forEach((a) => a.draw(ctx, skin));
    bullets.forEach((b) => b.draw(ctx, skin));
    ship.draw(ctx, skin, shieldTimer);

    drawPowerUpTimers();
  }

  // ── Bucle principal ───────────────────────────────────────────────────────
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
        lastTime = null; // descarta el dt acumulado durante la pausa
        rafId = requestAnimationFrame(loop);
      }
    },
    restart() {
      initGame();
    },
    end() {
      state = "gameover";
      emitState();
    },
    // Reemplaza la paleta en caliente: el siguiente frame ya se pinta con el
    // skin nuevo y la partida en curso sigue intacta.
    setSkin(next: AsteroidsSkin) {
      skin = SKINS[next] ?? SKINS.clasico;
      // En pausa no hay bucle que repinte: refresca el frame actual a mano.
      if (rafId === null) draw();
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
