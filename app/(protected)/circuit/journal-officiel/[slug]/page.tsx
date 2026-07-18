import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'communiques': { slug: 'journal-communiques', title: 'Communiqués', eyebrow: 'Journal officiel', intro: 'Retrouve les annonces officielles publiées par la direction du Nostra Circuit.' },
  'decisions': { slug: 'journal-decisions', title: 'Décisions', eyebrow: 'Journal officiel', intro: 'Décisions sportives, administratives et sanctions officielles.' },
  'resultats': { slug: 'journal-resultats', title: 'Résultats homologués', eyebrow: 'Journal officiel', intro: 'Résultats validés et publiés après chaque épreuve.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
