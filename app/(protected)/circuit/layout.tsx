export const dynamic = "force-dynamic";
export const revalidate = 0;

import { CircuitStatusBanner } from "@/components/site/circuit-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
import { PoleMaintenanceGuard } from "@/components/v153/pole-maintenance-guard";
import {
  getCircuitNavigationWithLicensesAndChampionshipTracks,
} from "@/lib/content/circuit-navigation-with-licenses-and-championship-tracks";

export default async function CircuitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items =
    await getCircuitNavigationWithLicensesAndChampionshipTracks();

  return (
    <PoleMaintenanceGuard pole="circuit">
    <SectionLayout
      title="NOSTRA CIRCUIT"
      items={items}
    >
      <CircuitStatusBanner />
      {children}
    </SectionLayout>
    </PoleMaintenanceGuard>
  );
}
