import type { ReactNode } from "react";

import { DealBoxSwapClient } from "@/components/games/deal-box-swap-client";
import { DealLiveFrame } from "@/components/games/deal-live-frame";
import { getDealPublicState } from "@/lib/deal/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DealPublicTemplate({
  children,
}: {
  children: ReactNode;
}) {
  const state = await getDealPublicState();

  return (
    <DealLiveFrame
      initialMode={state.viewer_mode}
      initialPlayerName={state.selected_player_name}
    >
      {children}
      <DealBoxSwapClient />
    </DealLiveFrame>
  );
}
