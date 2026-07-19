import { SectionLayout } from "@/components/site/section-layout";
import { getSectionNavigation } from "@/lib/content/section-navigation";

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items = await getSectionNavigation("evenements");
  return (
    <SectionLayout title="ÉVÉNEMENTS & JEUX" items={items}>
      {children}
    </SectionLayout>
  );
}
