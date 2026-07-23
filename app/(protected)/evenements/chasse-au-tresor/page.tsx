import { redirect } from "next/navigation";

import { TreasureHuntPublic } from "@/components/games/treasure-hunt-public";
import { getPublishedTreasureHunts } from "@/lib/treasure-hunt/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TreasureHuntPage() {
  const hunts = await getPublishedTreasureHunts();

  if (hunts.length === 0) {
    redirect("/evenements");
  }

  return <TreasureHuntPublic hunts={hunts} />;
}
