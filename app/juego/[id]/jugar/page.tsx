// Reproductor del juego. Server Component: resuelve el juego por params.id o
// llama a notFound(), y monta la isla Client <GamePlayer>.

import { notFound } from "next/navigation";
import { GamePlayer } from "@/app/_components/game-player";
import { AsteroidsGame } from "@/app/_components/games/asteroids-game";
import { getGameById } from "@/lib/games";

export default async function GamePlayerPage({
  params,
}: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  if (game.engine === "asteroids") {
    return <AsteroidsGame game={game} />;
  }

  return <GamePlayer game={game} />;
}
