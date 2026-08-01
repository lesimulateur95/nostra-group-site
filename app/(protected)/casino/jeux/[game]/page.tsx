import { notFound } from "next/navigation";

import { CasinoGame } from "@/components/casino/casino-game";
import { getCasinoGameSettings, getCasinoWallet } from "@/lib/casino/data";
import { CASINO_GAMES, type CasinoGameKey } from "@/lib/casino/types";

export default async function CasinoGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!CASINO_GAMES.includes(game as CasinoGameKey)) notFound();
  const [wallet, settings] = await Promise.all([getCasinoWallet(), getCasinoGameSettings()]);
  const gameSettings = settings.find((item) => item.game === game as CasinoGameKey);
  if (!gameSettings) notFound();
  return <CasinoGame game={game as CasinoGameKey} initialBalance={wallet?.balance ?? 0} settings={gameSettings} />;
}
