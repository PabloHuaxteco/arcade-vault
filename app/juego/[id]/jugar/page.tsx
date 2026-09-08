// Reproductor del juego. Server Component: resuelve el juego por params.id o
// llama a notFound(), y monta la isla Client <GamePlayer>.

import { notFound } from "next/navigation";
import { GamePlayer } from "@/app/_components/game-player";
import { GAMES } from "@/lib/games";

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
