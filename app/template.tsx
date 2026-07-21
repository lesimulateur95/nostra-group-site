import type { ReactNode } from "react";

import { EnvironmentBanner } from "@/components/system/environment-banner";

export default function RootTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <EnvironmentBanner />
      {children}
    </>
  );
}
