// ===== lib/games/types.ts — snapshot flexible compartido por los motores =====

export interface HudStat {
  l: string; // "Líneas", "Nivel"
  v: string; // valor ya formateado: "042", "3"
}

export interface GameSnapshot {
  score: number;
  over: boolean;
  stats: HudStat[]; // hasta 3 entradas
}
