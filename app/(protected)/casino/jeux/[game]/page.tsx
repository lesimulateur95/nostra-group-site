import { notFound, redirect } from "next/navigation";

import { CasinoGame } from "@/components/casino/casino-game";
import { CasinoNewSoloGame } from "@/components/casino/casino-new-solo-games";
import { CasinoProgressiveSoloGame } from "@/components/casino/casino-progressive-solo-games";
import { getCasinoGameSettings, getCasinoWallet } from "@/lib/casino/data";
import { CASINO_GAMES, type CasinoGameKey } from "@/lib/casino/types";

export default async function CasinoGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!CASINO_GAMES.includes(game as CasinoGameKey)) notFound();
  const [wallet, settings] = await Promise.all([getCasinoWallet(), getCasinoGameSettings()]);
  const gameSettings = settings.find((item) => item.game === game as CasinoGameKey);
  if (!gameSettings) notFound();
  if (["horse_racing", "slots_tournament", "card_battle"].includes(game)) redirect(`/casino/multijoueur#${game}`);
  if (game === "mines" || game === "mystery_boxes") {
    return <CasinoNewSoloGame game={game} initialBalance={wallet?.balance ?? 0} settings={gameSettings} />;
  }
  if (game === "hi_lo" || game === "skyscraper" || game === "memory") {
    return <CasinoProgressiveSoloGame game={game} initialBalance={wallet?.balance ?? 0} settings={gameSettings} />;
  }
  return <CasinoGame game={game as CasinoGameKey} initialBalance={wallet?.balance ?? 0} settings={gameSettings} />;
}
