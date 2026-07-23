import { TreasureHuntPublic } from "@/components/games/treasure-hunt-public";
import { getPublishedTreasureHunts } from "@/lib/treasure-hunt/data";

export default async function TreasureHuntPage() {
  const hunts = await getPublishedTreasureHunts();
  return <TreasureHuntPublic hunts={hunts} />;
}
