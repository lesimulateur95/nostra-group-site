export const dynamic = "force-dynamic";
export const revalidate = 0;

import { MotorsStatusBanner } from "@/components/site/motors-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
import { getSectionNavigation } from "@/lib/content/section-navigation";

export default async function MotorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items = await getSectionNavigation("motors");
  return (
    <SectionLayout title="NOSTRA MOTORS" items={items}>
      <MotorsStatusBanner />
      {children}
    </SectionLayout>
  );
}
