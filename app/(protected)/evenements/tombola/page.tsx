import Link from "next/link";
import { getActiveTombolaRound, getTombolaModuleConfigured, getTombolaWinners } from "@/lib/backoffice/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ticket(value: number) {
  return String(value).padStart(5, "0");
}

function money(value: number) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function TombolaPage() {
  const configured = await getTombolaModuleConfigured();
  const round = configured ? await getActiveTombolaRound() : null;
  const winners = round ? await getTombolaWinners(round.id) : [];
  const podiumOrder = [winners[1], winners[0], winners[2]];
  const extraWinners = winners.slice(3);

  return (
    <article className="tombola-page">
      <header className="document-hero tombola-hero">
        <p className="eyebrow">JEUX NOSTRA GROUP</p>
        <h1 className="page-title">Tombola</h1>
        <p className="lead">Achetez vos tickets depuis le formulaire d’inscription. Chaque ticket reçoit un numéro aléatoire unique et peut être sélectionné lors du tirage officiel.</p>
      </header>

      {!configured && <div className="dashboard-feedback">La tombola n’est pas encore activée par le Gérant.</div>}
      {configured && !round && <div className="dashboard-feedback">Aucune tombola active pour le moment.</div>}

      {round && (
        <>
          <section className="tombola-overview-grid">
            <article className="tombola-info-card">
              <p className="eyebrow">TOMBOLA ACTIVE</p>
              <h2>{round.title}</h2>
              <dl>
                <div><dt>Prix du ticket</dt><dd>{money(round.ticket_price)}</dd></div>
                <div><dt>État</dt><dd>{round.status === "open" ? "Inscriptions ouvertes" : round.status === "drawn" ? "Tirage terminé" : "Inscriptions fermées"}</dd></div>
              </dl>
              {round.status === "open" && <Link className="btn" href="/evenements/tombola/inscription">Acheter des tickets</Link>}
            </article>

            <article className="tombola-rules-card">
              <p className="eyebrow">FONCTIONNEMENT</p>
              <h2>Comment participer ?</h2>
              <ol>
                <li>Choisis ton nombre de tickets dans le formulaire.</li>
                <li>Valide la commande depuis le panier de ton profil.</li>
                <li>Le site attribue automatiquement des numéros uniques.</li>
                <li>Les gagnants sont affichés ici après le tirage officiel.</li>
              </ol>
            </article>
          </section>

          <section className="tombola-podium-section">
            <div className="profile-data-heading">
              <div><p className="eyebrow">RÉSULTATS OFFICIELS</p><h2>Podium de la tombola</h2></div>
            </div>

            {winners.length === 0 ? (
              <div className="tombola-empty-podium">
                <span>🏆</span>
                <strong>Le tirage n’a pas encore été effectué</strong>
                <p>Les gagnants et leurs numéros apparaîtront ici dès la publication du résultat.</p>
              </div>
            ) : (
              <>
                <div className="tombola-podium">
                  {podiumOrder.map((winner, index) => {
                    const positions = [2, 1, 3];
                    const position = positions[index];
                    return (
                      <article className={`tombola-podium-place tombola-podium-place-${position}`} key={position}>
                        <span className="tombola-medal">{position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"}</span>
                        {winner ? (
                          <>
                            <strong>{winner.customer_name}</strong>
                            <small>Ticket n° {ticket(winner.ticket_number)}</small>
                          </>
                        ) : (
                          <><strong>Place libre</strong><small>—</small></>
                        )}
                        <b>{position}</b>
                      </article>
                    );
                  })}
                </div>

                {extraWinners.length > 0 && (
                  <div className="tombola-extra-winners">
                    {extraWinners.map((winner) => (
                      <article key={winner.id}>
                        <span>#{winner.position}</span>
                        <strong>{winner.customer_name}</strong>
                        <small>Ticket n° {ticket(winner.ticket_number)}</small>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </article>
  );
}
