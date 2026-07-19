import Link from "next/link";
import { redirect } from "next/navigation";
import { BingoLiveGame } from "@/components/games/bingo-live-game";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getActiveBingoRound,
  getBingoDraws,
  getBingoModuleConfigured,
  getBingoWinners,
  getOwnBingoCards,
} from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function BingoPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const manager = roles.includes("manager");
  const configured = await getBingoModuleConfigured();
  const round = configured ? await getActiveBingoRound() : null;
  const [draws, winners, cards] = round
    ? await Promise.all([
        getBingoDraws(round.id),
        getBingoWinners(round.id),
        getOwnBingoCards(data.user.id),
      ])
    : [[], [], []];

  return (
    <article className="bingo-page">
      <header className="document-hero bingo-hero">
        <p className="eyebrow">JEUX NOSTRA GROUP</p>
        <h1 className="page-title">Bingo en direct</h1>
        <p className="lead">Suivez les numéros en temps réel, ouvrez vos grilles et marquez chaque numéro annoncé. La détection des Bingo est automatique côté organisation.</p>
      </header>

      {!configured && <div className="dashboard-feedback">Le Bingo n’est pas encore activé par le Gérant.</div>}
      {configured && !round && <div className="dashboard-feedback">Aucune édition de Bingo active.</div>}

      {round && (
        <>
          <section className="bingo-round-summary">
            <div><span>ÉDITION ACTIVE</span><strong>{round.title}</strong></div>
            <div><span>Prix d’une grille</span><strong>{money(round.card_price)}</strong></div>
            <div><span>État</span><strong>{round.status === "open" ? "Inscriptions ouvertes" : round.status === "playing" ? "Partie en cours" : round.status === "completed" ? "Terminée" : "Inscriptions fermées"}</strong></div>
            {round.status === "open" && <Link className="btn" href="/evenements/bingo/inscription">Acheter des grilles</Link>}
          </section>
          <BingoLiveGame roundId={round.id} phase={round.phase} status={round.status} initialDraws={draws} initialWinners={winners} cards={cards} manager={manager} />
        </>
      )}
    </article>
  );
}
