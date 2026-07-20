
import { EventStandings } from "@/components/special-rankings/public-special-rankings";
import { getEventStandings } from "@/lib/special-rankings/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EventRankingPage() {
  const standings = await getEventStandings();

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">CLASSEMENTS OFFICIELS</p>
        <h1 className="page-title">Classement événements</h1>
        <p className="lead">
          Classement général des pilotes sur les événements spéciaux
          organisés par le Nostra Circuit.
        </p>
      </section>

      <EventStandings standings={standings} />
    </main>
  );
}
