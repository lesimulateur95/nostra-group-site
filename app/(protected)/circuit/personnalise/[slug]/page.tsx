import { CustomCircuitPage } from "@/components/site/custom-circuit-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CustomCircuitPage slug={slug} />;
}
