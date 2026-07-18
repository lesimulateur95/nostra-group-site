import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'piste': { slug: 'circuit-reglement-piste', title: 'Règlement en piste', eyebrow: 'Règlement', intro: 'Consignes officielles applicables pendant les courses et sessions en piste.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
