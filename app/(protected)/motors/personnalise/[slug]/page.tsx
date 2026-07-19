import { CustomSectionPage } from "@/components/site/custom-section-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CustomSectionPage section="motors" slug={slug} />;
}
