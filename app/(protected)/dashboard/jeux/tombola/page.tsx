import { drawTombola, resetTombola, updateTombolaSettings } from "@/app/actions/tombola";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getActiveTombolaRound,
  getTombolaModuleConfigured,
  getTombolaPurchases,
  getTombolaTickets,
  getTombolaWinners,
} from "@/lib/backoffice/data";
import { TOMBOLA_SETUP_SQL } from "@/lib/backoffice/tombola-setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function ticket(value: number) {
  return String(value).padStart(5, "0");
}

export default async function TombolaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; drawn?: string; reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = await getTombolaModuleConfigured();
  const round = configured ? await getActiveTombolaRound() : null;
  const [tickets, purchases, winners] = round
    ? await Promise.all([
        getTombolaTickets(round.id),
        getTombolaPurchases(round.id),
        getTombolaWinners(round.id),
      ])
    : [[], [], []];

  const revenue = purchases.reduce((total, purchase) => total + Number(purchase.total), 0);
  const participants = new Set(tickets.map((item) => item.user_id)).size;

  const errorMessage = params.error === "drawn"
    ? "Le tirage a déjà été effectué. Réinitialise la tombola pour lancer une nouvelle édition."
    : params.error === "tickets"
      ? "Aucun ticket n’a encore été vendu."
      : params.error === "winners"
        ? "Le nombre de gagnants dépasse le nombre de tickets vendus."
        : params.error === "setup"
          ? "La tombola doit d’abord être activée dans Supabase."
          : params.error
            ? "L’opération n’a pas pu être enregistrée. Vérifie les informations."
            : null;

  return (
    <DashboardShell>
      <DashboardHeader
        eyebrow="JEUX NOSTRA GROUP"
        title="Gestion de la tombola"
        description="Définis le prix du ticket, consulte tous les numéros attribués, choisis le nombre de gagnants et réinitialise la tombola après l’événement."
      />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation V31 nécessaire</span>
          <h2>Activer la tombola</h2>
          <p>Exécute ce code une seule fois dans Supabase → SQL Editor → New query, puis recharge cette page.</p>
          <details><summary>Afficher le code SQL V31</summary><pre>{TOMBOLA_SETUP_SQL}</pre></details>
        </section>
      )}

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Les paramètres de la tombola sont enregistrés.</div>}
      {params.drawn && <div className="dashboard-feedback dashboard-feedback-success">Le tirage est terminé et le podium est publié.</div>}
      {params.reset && <div className="dashboard-feedback dashboard-feedback-success">La tombola a été réinitialisée. Une nouvelle édition est ouverte.</div>}
      {errorMessage && <div className="dashboard-feedback dashboard-feedback-error">{errorMessage}</div>}

      {configured && round && (
        <>
          <section className="dashboard-kpi-grid tombola-dashboard-kpis">
            <article><span>Tickets vendus</span><strong>{tickets.length}</strong></article>
            <article><span>Participants</span><strong>{participants}</strong></article>
            <article><span>Recette totale</span><strong>{money(revenue)}</strong></article>
            <article><span>Gagnants</span><strong>{winners.length}</strong></article>
          </section>

          <section className="tombola-dashboard-controls">
            <article className="backoffice-panel">
              <div className="panel-heading"><span className="panel-icon">⚙️</span><div><h2>Paramètres</h2><p>Le prix enregistré est utilisé automatiquement dans le panier des citoyens.</p></div></div>
              <form action={updateTombolaSettings} className="tombola-settings-form">
                <label><span>Nom de la tombola</span><input name="title" defaultValue={round.title} required maxLength={120} /></label>
                <label><span>Prix d’un ticket (€)</span><input name="ticket_price" type="number" min="0" step="0.01" defaultValue={round.ticket_price} required /></label>
                <label><span>Inscriptions</span><select name="status" defaultValue={round.status === "open" ? "open" : "closed"}><option value="open">Ouvertes</option><option value="closed">Fermées</option></select></label>
                <button className="btn" type="submit">Enregistrer les paramètres</button>
              </form>
            </article>

            <article className="backoffice-panel">
              <div className="panel-heading"><span className="panel-icon">🏆</span><div><h2>Tirage au sort</h2><p>Choisis le nombre de gagnants. Chaque ticket ne peut gagner qu’une seule fois.</p></div></div>
              <form action={drawTombola} className="tombola-draw-form">
                <label><span>Nombre de gagnants</span><input name="winner_count" type="number" min="1" max="20" defaultValue={Math.min(3, Math.max(1, tickets.length))} required /></label>
                <button className="btn" type="submit" disabled={tickets.length === 0 || winners.length > 0}>Lancer le tirage au sort</button>
              </form>
              {winners.length > 0 && <p className="commerce-hint">Le tirage est verrouillé. Utilise le bouton de réinitialisation pour préparer la prochaine tombola.</p>}

              <details className="tombola-reset-confirmation">
                <summary className="danger-link-button">Réinitialiser la tombola</summary>
                <form action={resetTombola}>
                  <input type="hidden" name="confirmation" value="RESET_TOMBOLA" />
                  <p>Cette action archive les tickets, les ventes et le podium actuels, puis ouvre une nouvelle édition avec le même prix.</p>
                  <button className="danger-link-button" type="submit">Oui, réinitialiser définitivement</button>
                </form>
              </details>
            </article>
          </section>

          <section className="backoffice-panel tombola-dashboard-podium-panel">
            <div className="panel-heading"><span className="panel-icon">🥇</span><div><h2>Podium publié</h2><p>Le numéro et le nom RP associés sont affichés automatiquement.</p></div></div>
            <div className="tombola-dashboard-winners">
              {winners.length === 0 && <p className="empty-state">Aucun tirage effectué.</p>}
              {winners.map((winner) => (
                <article key={winner.id}>
                  <span>#{winner.position}</span>
                  <strong>{winner.customer_name}</strong>
                  <small>Ticket n° {ticket(winner.ticket_number)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="backoffice-panel">
            <div className="panel-heading"><span className="panel-icon">🎟️</span><div><h2>Tickets vendus</h2><p>Vue complète des numéros attribués et de leurs propriétaires.</p></div></div>
            <div className="tombola-ticket-table">
              {tickets.length === 0 && <p className="empty-state">Aucun ticket vendu pour le moment.</p>}
              {tickets.map((item) => (
                <article key={item.id}>
                  <strong>n° {ticket(item.ticket_number)}</strong>
                  <span>{item.customer_name}</span>
                  <small>{item.order_number ?? "Commande Tombola"}</small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
