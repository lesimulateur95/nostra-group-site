import { SiteSectionEditor } from "@/components/dashboard/site-section-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CircuitContentEditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SiteSectionEditor section="circuit" searchParams={await searchParams} />;
}
