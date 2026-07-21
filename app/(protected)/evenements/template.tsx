import type { ReactNode } from "react";

import { AuctionPortalCard } from "@/components/auctions/auction-portal-card";

export default function EventsTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AuctionPortalCard />
      {children}
    </>
  );
}
