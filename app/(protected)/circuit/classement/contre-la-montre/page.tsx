
import { TimeTrialRankings } from "@/components/special-rankings/public-special-rankings";
import { getTimeTrialRankings } from "@/lib/special-rankings/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TimeTrialRankingPage() {
  const records = await getTimeTrialRankings();

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">CLASSEMENTS OFFICIELS</p>
        <h1 className="page-title">
          Classement chrono contre la montre
        </h1>
        <p className="lead">
          Les meilleurs chronos réalisés sur chaque parcours de
          contre-la-montre du Nostra Circuit.
        </p>
      </section>

      <TimeTrialRankings records={records} />
    </main>
  );
}
