import { redirect } from "next/navigation";
import { TombolaRegistrationForm } from "@/components/games/tombola-registration-form";
import { getRpName } from "@/lib/auth/user-profile";
import { getActiveTombolaRound, getTombolaModuleConfigured } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TombolaRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const params = await searchParams;
  const configured = await getTombolaModuleConfigured();
  const round = configured ? await getActiveTombolaRound() : null;
  const rpName = getRpName(data.user);
  const [firstName = "", ...lastParts] = rpName.split(" ");
  const lastName = lastParts.join(" ");

  const errorMessage = params.error === "invalid"
    ? "Vérifie ton nom RP et choisis entre 1 et 100 tickets."
    : params.error === "closed"
      ? "Les inscriptions à cette tombola sont actuellement fermées."
      : params.error === "setup"
        ? "La tombola doit d’abord être activée depuis le Dashboard."
        : params.error
          ? "Impossible d’ajouter les tickets au panier. Réessaie dans un instant."
          : null;

  return (
    <article className="tombola-page">
      <header className="document-hero tombola-hero">
        <p className="eyebrow">TOMBOLA NOSTRA GROUP</p>
        <h1 className="page-title">Formulaire d’inscription</h1>
        <p className="lead">Choisis le nombre de tickets souhaité. Ils seront ajoutés à ton panier, puis tes numéros seront distribués après la validation de la commande dans ton profil.</p>
      </header>

      {!configured && <div className="dashboard-feedback">La tombola n’est pas encore activée par le Gérant.</div>}
      {configured && !round && <div className="dashboard-feedback">Aucune tombola active pour le moment.</div>}
      {errorMessage && <div className="dashboard-feedback dashboard-feedback-error">{errorMessage}</div>}

      {round && (
        <section className="tombola-registration-card">
          <div className="tombola-registration-heading">
            <div>
              <p className="eyebrow">INSCRIPTIONS</p>
              <h2>{round.title}</h2>
            </div>
            <span className={`tombola-status tombola-status-${round.status}`}>
              {round.status === "open" ? "Ouverte" : round.status === "drawn" ? "Tirage terminé" : "Fermée"}
            </span>
          </div>

          {round.status === "open" ? (
            <TombolaRegistrationForm
              firstName={firstName}
              lastName={lastName}
              ticketPrice={Number(round.ticket_price)}
            />
          ) : (
            <p className="empty-state">Les inscriptions sont fermées pour cette tombola.</p>
          )}
        </section>
      )}
    </article>
  );
}
