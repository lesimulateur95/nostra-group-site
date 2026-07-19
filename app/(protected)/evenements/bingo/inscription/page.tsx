import { redirect } from "next/navigation";
import { BingoRegistrationForm } from "@/components/games/bingo-registration-form";
import { getRpName } from "@/lib/auth/user-profile";
import { getActiveBingoRound, getBingoModuleConfigured } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BingoRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const params = await searchParams;
  const configured = await getBingoModuleConfigured();
  const round = configured ? await getActiveBingoRound() : null;
  const rpName = getRpName(data.user);
  const [firstName = "", ...lastParts] = rpName.split(" ");
  const lastName = lastParts.join(" ");

  const errorMessage = params.error === "invalid"
    ? "Vérifie ton nom RP et choisis entre 1 et 20 grilles."
    : params.error === "closed"
      ? "Les ventes de grilles sont actuellement fermées."
      : params.error === "setup"
        ? "Le Bingo doit d’abord être activé depuis le Dashboard."
        : params.error
          ? "Impossible d’ajouter les grilles au panier."
          : null;

  return (
    <article className="bingo-page">
      <header className="document-hero bingo-hero">
        <p className="eyebrow">BINGO NOSTRA GROUP</p>
        <h1 className="page-title">Acheter mes grilles</h1>
        <p className="lead">Choisis le nombre de grilles. Elles seront générées avec 24 numéros uniques entre 1 et 99 après la commande dans ton profil.</p>
      </header>

      {!configured && <div className="dashboard-feedback">Le Bingo n’est pas encore activé par le Gérant.</div>}
      {configured && !round && <div className="dashboard-feedback">Aucune édition active.</div>}
      {errorMessage && <div className="dashboard-feedback dashboard-feedback-error">{errorMessage}</div>}

      {round && (
        <section className="bingo-registration-card">
          <div className="bingo-registration-heading">
            <div><p className="eyebrow">VENTE DES GRILLES</p><h2>{round.title}</h2></div>
            <span className={`bingo-status bingo-status-${round.status}`}>{round.status === "open" ? "Ouverte" : "Fermée"}</span>
          </div>
          {round.status === "open" ? <BingoRegistrationForm firstName={firstName} lastName={lastName} cardPrice={Number(round.card_price)} /> : <p className="empty-state">Les ventes sont fermées.</p>}
        </section>
      )}
    </article>
  );
}
