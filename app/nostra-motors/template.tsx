import type { ReactNode } from "react";
import {
  MotorsPublicEnhancements,
  MotorsPublicNavigation,
} from "@/components/motors/motors-public-integration";
import { getPublicCatalogVehiclesV41 } from "@/lib/nostra-motors/v41-data";

type Props = {
  children: ReactNode;
};

export default async function NostraMotorsTemplate({ children }: Props) {
  const vehicles = await getPublicCatalogVehiclesV41();

  return (
    <>
      <MotorsPublicNavigation />
      {children}
      <MotorsPublicEnhancements vehicles={vehicles} />
    </>
  );
}
