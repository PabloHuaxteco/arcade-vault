// ===== lib/storage.ts — persistencia en localStorage, equivalente a la del template =====
//
// Claves de localStorage: "av_user", "av_scores".
// Todas las funciones son seguras en SSR (comprueban `typeof window`) y envuelven
// el acceso a localStorage en try/catch para tolerar el modo privado.

export interface StoredUser {
  name: string; // en mayúsculas, máx. 10 caracteres
}

export interface StoredScore {
  game: string; // Game["id"]
  score: number;
  name: string;
  at: number; // Date.now()
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export function readUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function writeUser(user: StoredUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* localStorage no disponible: la UI sigue sin persistir */
  }
}

export function clearUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

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
    const all: StoredScore[] = JSON.parse(window.localStorage.getItem(SCORES_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}
