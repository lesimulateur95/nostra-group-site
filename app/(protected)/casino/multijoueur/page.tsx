import { CasinoMultiplayer } from "@/components/casino/casino-multiplayer";
import { CasinoLiveTables } from "@/components/casino/casino-live-tables";
import { getCasinoWallet } from "@/lib/casino/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasinoMultiplayerPage() {
  const wallet = await getCasinoWallet();
  const balance = wallet?.balance ?? 0;
  return <><CasinoLiveTables initialBalance={balance} /><CasinoMultiplayer initialBalance={balance} /></>;
}
