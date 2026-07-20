import type { ReactNode } from "react";

import { CatalogueComparatorEnhancer } from "@/components/motors/catalogue-comparator-enhancer";

export default function MotorsCatalogueTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <CatalogueComparatorEnhancer />
    </>
  );
}
