export const dynamic = "force-dynamic";
export const revalidate = 0;

import { CircuitStatusBanner } from "@/components/site/circuit-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
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
    <SectionLayout
      title="NOSTRA CIRCUIT"
      items={items}
    >
      <CircuitStatusBanner />
      {children}
    </SectionLayout>
  );
}
