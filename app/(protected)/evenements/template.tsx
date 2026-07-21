import type { ReactNode } from "react";

import { FortunePortalCard } from "@/components/fortune/fortune-portal-card";

export default function EventsTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <FortunePortalCard />
      {children}
    </>
  );
}
