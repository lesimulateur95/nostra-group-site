export const dynamic = "force-dynamic";

export const revalidate = 0;

import { CircuitStatusBanner } from "@/components/site/circuit-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
import { getCircuitNavigationWithLicenses } from "@/lib/content/circuit-navigation-with-licenses";

export default async function CircuitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items = await getCircuitNavigationWithLicenses();

  return (
    <SectionLayout title="NOSTRA CIRCUIT" items={items}>
      <CircuitStatusBanner />
      {children}
    </SectionLayout>
  );
}
