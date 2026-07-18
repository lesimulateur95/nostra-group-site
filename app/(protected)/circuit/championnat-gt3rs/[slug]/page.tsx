import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'calendrier': { slug: 'gt3-calendrier', title: 'Calendrier GT3 RS', eyebrow: 'Championnat GT3 RS', intro: 'Dates, horaires et manches officielles du championnat Porsche GT3 RS.' },
  'participants': { slug: 'gt3-participants', title: 'Pilotes GT3 RS', eyebrow: 'Championnat GT3 RS', intro: 'Liste officielle des pilotes engagés.' },
  'resultats': { slug: 'gt3-resultats', title: 'Résultats GT3 RS', eyebrow: 'Championnat GT3 RS', intro: 'Résultats homologués après chaque manche.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
