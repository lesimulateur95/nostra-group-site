import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'calendrier': { slug: 'f1-calendrier', title: 'Calendrier F1', eyebrow: 'Championnat F1', intro: 'Dates, horaires et manches officielles du championnat F1.' },
  'participants': { slug: 'f1-participants', title: 'Pilotes & écuries', eyebrow: 'Championnat F1', intro: 'Liste officielle des pilotes et écuries engagés.' },
  'resultats': { slug: 'f1-resultats', title: 'Résultats F1', eyebrow: 'Championnat F1', intro: 'Résultats homologués après chaque manche.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
