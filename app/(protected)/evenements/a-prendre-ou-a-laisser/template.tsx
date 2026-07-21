import type { ReactNode } from "react";

import { DealBoxSwapClient } from "@/components/games/deal-box-swap-client";

export default function DealPublicTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <DealBoxSwapClient />
    </>
  );
}
