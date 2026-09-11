// ===== lib/scores.ts — lecturas de puntuaciones desde Supabase (servidor) =====
//
// insertScore vive en lib/scores-client.ts, no aquí: este módulo importa
// lib/supabase/server.ts (usa next/headers), que Next.js no puede empaquetar
// si un componente cliente (asteroids-game.tsx) llega a importar algo de
// este archivo. Mantener las lecturas de servidor y la escritura de
// navegador en archivos separados evita ese conflicto de bundling.

import { createClient as createServerClient } from "@/lib/supabase/server";

export interface ScoreRow {
  rank: number;
  name: string; // "PX_KAI"
  score: number;
  date: string; // "dd/mm/yyyy", derivado de created_at
}

function formatDate(createdAt: string): string {
  const d = new Date(createdAt);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export async function getTopScores(
  gameId: string,
  limit = 10
): Promise<ScoreRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}

export async function getTopScoresByGames(
  gameIds: string[],
  limit = 12
): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createServerClient();

  const results = await Promise.all(
    gameIds.map(async (gameId) => {
      const { data, error } = await supabase
        .from("scores")
        .select("name, score, created_at")
        .eq("game_id", gameId)
        .order("score", { ascending: false })
        .limit(limit);

      const rows: ScoreRow[] =
        error || !data
          ? []
          : data.map((row, i) => ({
              rank: i + 1,
              name: row.name,
              score: row.score,
              date: formatDate(row.created_at),
            }));

      return [gameId, rows] as const;
    })
  );

  return Object.fromEntries(results);
}
