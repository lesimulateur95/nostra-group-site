import { CircuitStatusBanner } from "@/components/site/circuit-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
import { getCircuitNavigation } from "@/lib/content/circuit-navigation";

export default async function CircuitLayout({ children }: { children: React.ReactNode }) {
  const items = await getCircuitNavigation();
  return (
    <SectionLayout title="NOSTRA CIRCUIT" items={items}>
      <CircuitStatusBanner />
      {children}
    </SectionLayout>
  );
}
