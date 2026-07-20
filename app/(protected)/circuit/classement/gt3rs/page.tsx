
import { DriverStandingsTable } from "@/components/race-control/public-race-tables";
import { getPublicDriverStandings } from "@/lib/race-control/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DriverStandingsPage() {
  const standings = await getPublicDriverStandings("gt3rs");

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">CLASSEMENTS OFFICIELS</p>
        <h1 className="page-title">Classement des pilotes GT3 RS</h1>
        <p className="lead">
          Classement calculé automatiquement à partir des résultats
          publiés par les commissaires.
        </p>
      </section>

      <DriverStandingsTable standings={standings} />
    </main>
  );
}
