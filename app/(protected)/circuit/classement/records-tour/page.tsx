
import { CircuitLapRecords } from "@/components/special-rankings/public-special-rankings";
import { getCircuitLapRecords } from "@/lib/special-rankings/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CircuitLapRecordsPage() {
  const records = await getCircuitLapRecords();

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">RECORDS OFFICIELS</p>
        <h1 className="page-title">Records du tour circuit</h1>
        <p className="lead">
          Les meilleurs tours homologués sur chaque tracé du Nostra
          Circuit.
        </p>
      </section>

      <CircuitLapRecords records={records} />
    </main>
  );
}
