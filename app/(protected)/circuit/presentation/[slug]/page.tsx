import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'activites': { slug: 'circuit-activities', title: 'Nos activités', eyebrow: 'Présentation officielle', intro: 'Sessions libres, essais privés, championnats, homologations et journées découvertes du Nostra Circuit.' },
  'valeurs': { slug: 'circuit-values', title: 'Nos valeurs', eyebrow: 'Présentation officielle', intro: 'Sécurité, respect, fair-play, professionnalisme et passion automobile.' },
  'installations': { slug: 'circuit-installations', title: 'Nos installations', eyebrow: 'Présentation officielle', intro: 'Piste, stands, accueil, direction de course et système de championnat officiel.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
