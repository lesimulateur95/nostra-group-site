
import { PublicRaceResults } from "@/components/race-control/public-race-tables";
import { getPublicRaceResults } from "@/lib/race-control/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResultsPage() {
  const events = await getPublicRaceResults("f1");

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">CHAMPIONNAT F1</p>
        <h1 className="page-title">Résultats F1</h1>
        <p className="lead">
          Résultats chronométrés et homologués par la direction de
          course du Nostra Circuit.
        </p>
      </section>

      <PublicRaceResults events={events} />
    </main>
  );
}
