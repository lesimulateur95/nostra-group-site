import { CasinoMultiplayer } from "@/components/casino/casino-multiplayer";
import { getCasinoWallet } from "@/lib/casino/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasinoMultiplayerPage() {
  const wallet = await getCasinoWallet();
  return <CasinoMultiplayer initialBalance={wallet?.balance ?? 0} />;
}
