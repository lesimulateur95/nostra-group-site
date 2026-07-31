import { notFound } from "next/navigation";

import { CasinoGame } from "@/components/casino/casino-game";
import { getCasinoWallet } from "@/lib/casino/data";
import { CASINO_GAMES, type CasinoGameKey } from "@/lib/casino/types";

export default async function CasinoGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!CASINO_GAMES.includes(game as CasinoGameKey)) notFound();
  const wallet = await getCasinoWallet();
  return <CasinoGame game={game as CasinoGameKey} initialBalance={wallet?.balance ?? 0} />;
}
