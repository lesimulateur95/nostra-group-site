import type { ReactNode } from "react";

import { DealBoxSwapManager } from "@/components/games/deal-box-swap-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DealManagerTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <DealBoxSwapManager />
    </>
  );
}
