
import { DealGame } from "@/components/games/deal-game";
import { getDealPublicState } from "@/lib/deal/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DealOrNoDealPage() {
  const state = await getDealPublicState();

  return (
    <main className="content-page">
      <section className="document-hero">
        <p className="eyebrow">JEUX NOSTRA GROUP</p>
        <h1 className="page-title">À Prendre ou à Laisser</h1>
        <p className="lead">
          Choisis ta boîte, élimine les autres et attends les appels
          du banquier. Chaque proposition est déclenchée en direct par
          le Gérant.
        </p>
      </section>

      <DealGame initialState={state} />
    </main>
  );
}
