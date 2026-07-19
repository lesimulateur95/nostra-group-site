import { notFound } from "next/navigation";
import { ChampionshipCalendar } from "@/components/calendar/championship-calendar";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";
import { getChampionshipEvents } from "@/lib/backoffice/data";

const pages = {
  participants: { slug: "f1-participants", title: "Pilotes & écuries", eyebrow: "Championnat F1", intro: "Liste officielle des pilotes et écuries engagés." },
  resultats: { slug: "f1-resultats", title: "Résultats F1", eyebrow: "Championnat F1", intro: "Résultats homologués après chaque manche." },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "calendrier") {
    const events = await getChampionshipEvents("f1");
    return (
      <article className="circuit-document">
        <header className="document-hero"><p className="eyebrow">CHAMPIONNAT F1</p><h1 className="page-title">Calendrier F1</h1><p className="document-intro">Toutes les manches et événements officiels publiés depuis le Dashboard Gérant.</p></header>
        <ChampionshipCalendar events={events} title="SAISON F1" refreshKey="f1" />
      </article>
    );
  }
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
