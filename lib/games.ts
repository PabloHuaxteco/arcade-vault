// ===== lib/games.ts — catálogo de juegos desde Supabase (tabla "games") =====

import { createClient } from "@/lib/supabase/server";

export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string; // "bloque-buster"
  title: string; // "BLOQUE BUSTER"
  short: string; // descripción corta para la tarjeta
  long: string; // descripción larga para el detalle
  cat: GameCategory;
  cover: string; // clase CSS de portada: "cover-bricks", "cover-tetro", ...
  color: GameColor;
  best: number; // ya resuelto: MAX(scores.score) o el valor semilla si no hay filas
  plays: string; // "12.4K"
  engine?: "asteroids"; // si está, la ruta /juego/[id]/jugar monta el motor real
}

export const CATS: readonly string[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();

  const [
    { data: games, error: gamesError },
    { data: scores, error: scoresError },
  ] = await Promise.all([
    supabase.from("games").select("*"),
    supabase.from("scores").select("game_id, score"),
  ]);

  if (gamesError || !games) return [];

  const bestByGame = new Map<string, number>();
  if (!scoresError && scores) {
    for (const row of scores) {
      const current = bestByGame.get(row.game_id) ?? 0;
      if (row.score > current) bestByGame.set(row.game_id, row.score);
    }
  }

  return games.map((g) => ({
    id: g.id,
    title: g.title,
    short: g.short,
    long: g.long,
    cat: g.cat as GameCategory,
    cover: g.cover,
    color: g.color as GameColor,
    best: Math.max(g.best, bestByGame.get(g.id) ?? 0),
    plays: g.plays,
    engine: (g.engine as "asteroids" | null) ?? undefined,
  }));
}

export async function getGameById(id: string): Promise<Game | null> {
  const supabase = await createClient();

  const [{ data: game, error: gameError }, { data: topScore }] =
    await Promise.all([
      supabase.from("games").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("scores")
        .select("score")
        .eq("game_id", id)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (gameError || !game) return null;

  return {
    id: game.id,
    title: game.title,
    short: game.short,
    long: game.long,
    cat: game.cat as GameCategory,
    cover: game.cover,
    color: game.color as GameColor,
    best: Math.max(game.best, topScore?.score ?? 0),
    plays: game.plays,
    engine: (game.engine as "asteroids" | null) ?? undefined,
  };
}
