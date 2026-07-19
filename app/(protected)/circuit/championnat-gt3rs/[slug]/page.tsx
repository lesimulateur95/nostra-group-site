import { notFound } from "next/navigation";
import { ChampionshipCalendar } from "@/components/calendar/championship-calendar";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";
import { getChampionshipEvents } from "@/lib/backoffice/data";

const pages = {
  participants: { slug: "gt3-participants", title: "Pilotes GT3 RS", eyebrow: "Championnat GT3 RS", intro: "Liste officielle des pilotes engagés." },
  resultats: { slug: "gt3-resultats", title: "Résultats GT3 RS", eyebrow: "Championnat GT3 RS", intro: "Résultats homologués après chaque manche." },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "calendrier") {
    const events = await getChampionshipEvents("gt3rs");
    return (
      <article className="circuit-document">
        <header className="document-hero"><p className="eyebrow">CHAMPIONNAT GT3 RS</p><h1 className="page-title">Calendrier GT3 RS</h1><p className="document-intro">Toutes les manches et événements officiels publiés depuis le Dashboard Gérant.</p></header>
        <ChampionshipCalendar events={events} title="SAISON GT3 RS" refreshKey="gt3rs" />
      </article>
    );
  }
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
