export const dynamic = "force-dynamic";
export const revalidate = 0;

import { CircuitStatusBanner } from "@/components/site/circuit-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
import {
  getCircuitNavigationWithLicensesAndGt3Tracks,
} from "@/lib/content/circuit-navigation-with-licenses-and-gt3-tracks";

export default async function CircuitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items =
    await getCircuitNavigationWithLicensesAndGt3Tracks();

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
