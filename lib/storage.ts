// ===== lib/storage.ts — persistencia en localStorage, equivalente a la del template =====
//
// Clave de localStorage: "av_scores".
// Todas las funciones son seguras en SSR (comprueban `typeof window`) y envuelven
// el acceso a localStorage en try/catch para tolerar el modo privado.

export interface StoredScore {
  game: string; // Game["id"]
  score: number;
  name: string;
  at: number; // Date.now()
}

const SCORES_KEY = "av_scores";

export function readScores(): StoredScore[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SCORES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function appendScore(entry: Omit<StoredScore, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const all: StoredScore[] = JSON.parse(
      window.localStorage.getItem(SCORES_KEY) || "[]"
    );
    all.push({ ...entry, at: Date.now() });
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}
