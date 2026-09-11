// ===== lib/scores-client.ts — escritura de puntuaciones desde el navegador =====
//
// Separado de lib/scores.ts (lecturas de servidor) porque este archivo se
// importa desde componentes "use client" (asteroids-game.tsx): usa el
// cliente de navegador de Supabase y no debe arrastrar lib/supabase/server.ts
// (que depende de next/headers) al bundle del cliente.

import { createClient } from "@/lib/supabase/client";

export async function insertScore(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.gameId,
    name: entry.name,
    score: entry.score,
  });

  if (error) throw error;
}
