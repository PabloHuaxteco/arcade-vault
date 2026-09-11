// Salón de la Fama — Server Component que monta la isla Client <HallOfFame>.
// Portado de references/templates/salon.jsx.

import { HallOfFame } from "@/app/_components/hall-of-fame";
import { getGames } from "@/lib/games";
import { getTopScoresByGames } from "@/lib/scores";

export default async function SalonPage() {
  const games = await getGames();
  const scoresByGame = await getTopScoresByGames(
    games.map((g) => g.id),
    12
  );

  return <HallOfFame games={games} scoresByGame={scoresByGame} />;
}
