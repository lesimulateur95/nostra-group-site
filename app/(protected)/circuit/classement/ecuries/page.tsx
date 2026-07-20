
import { TeamStandingsTable } from "@/components/race-control/public-race-tables";
import { getPublicTeamStandings } from "@/lib/race-control/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamStandingsPage() {
  const [f1, gt3rs] = await Promise.all([
    getPublicTeamStandings("f1"),
    getPublicTeamStandings("gt3rs"),
  ]);

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">CLASSEMENTS OFFICIELS</p>
        <h1 className="page-title">Classement des écuries</h1>
        <p className="lead">
          Points cumulés automatiquement à partir des courses
          homologuées du Nostra Circuit.
        </p>
      </section>

      <section className="document-section">
        <p className="eyebrow">CHAMPIONNAT F1</p>
        <h2>Écuries F1</h2>
        <TeamStandingsTable standings={f1} />
      </section>

      <section className="document-section">
        <p className="eyebrow">CHAMPIONNAT GT3 RS</p>
        <h2>Écuries GT3 RS</h2>
        <TeamStandingsTable standings={gt3rs} />
      </section>
    </main>
  );
}
