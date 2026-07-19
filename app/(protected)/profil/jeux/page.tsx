import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { BingoCard } from "@/components/games/bingo-card";
import {
  getOwnBingoCards,
  getOwnTombolaTickets,
  getOwnWheelSpins,
  getBingoDraws,
  getBingoModuleConfigured,
  getActiveBingoRound,
  getTombolaModuleConfigured,
  getWheelModuleConfigured,
} from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  unused: "À utiliser",
  used: "Utilisé",
  lost: "Perdu",
};

function ticket(value: number) {
  return String(value).padStart(5, "0");
}

export default async function ProfileGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ tombola_order?: string; bingo_order?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const params = await searchParams;
  const [wheelConfigured, tombolaConfigured, bingoConfigured] = await Promise.all([
    getWheelModuleConfigured(),
    getTombolaModuleConfigured(),
    getBingoModuleConfigured(),
  ]);
  const bingoRound = bingoConfigured ? await getActiveBingoRound() : null;
  const [spins, tombolaTickets, bingoCards, bingoDraws] = await Promise.all([
    wheelConfigured ? getOwnWheelSpins(data.user.id) : Promise.resolve([]),
    tombolaConfigured ? getOwnTombolaTickets(data.user.id) : Promise.resolve([]),
    bingoConfigured ? getOwnBingoCards(data.user.id) : Promise.resolve([]),
    bingoRound ? getBingoDraws(bingoRound.id) : Promise.resolve([]),
  ]);

  const available = spins.filter((spin) => spin.redemption_status === "unused").length;
  const used = spins.filter((spin) => spin.redemption_status === "used").length;

  const ticketsByOrder = new Map<string, typeof tombolaTickets>();
  for (const item of tombolaTickets) {
    const key = item.order_number ?? `Commande-${item.purchase_id}`;
    const current = ticketsByOrder.get(key) ?? [];
    current.push(item);
    ticketsByOrder.set(key, current);
  }

  return (
    <>
      <ProfileSectionHeader eyebrow="JEUX NOSTRA GROUP" title="Mes jeux" description="Retrouve tes bonus de la roue, tes tickets de tombola et toutes tes grilles de Bingo." />

      {params.bingo_order && <div className="dashboard-feedback dashboard-feedback-success">Commande <strong>{params.bingo_order}</strong> validée : tes grilles Bingo sont prêtes.</div>}

      {params.tombola_order && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Commande <strong>{params.tombola_order}</strong> validée. Tes numéros de tombola sont affichés ci-dessous.
        </div>
      )}

      {!wheelConfigured && !tombolaConfigured && !bingoConfigured && <div className="dashboard-feedback">Les jeux ne sont pas encore activés par le Gérant.</div>}

      <section className="profile-games-kpis">
        <article><span>Tirages roue</span><strong>{spins.length}</strong></article>
        <article><span>Bonus disponibles</span><strong>{available}</strong></article>
        <article><span>Bonus utilisés</span><strong>{used}</strong></article>
        <article><span>Tickets tombola</span><strong>{tombolaTickets.length}</strong></article>
        <article><span>Grilles Bingo</span><strong>{bingoCards.length}</strong></article>
      </section>

      {tombolaConfigured && (
        <section className="profile-data-section profile-standalone-section">
          <div className="profile-data-heading">
            <div><p className="eyebrow">MES NUMÉROS</p><h2>Tickets de tombola</h2></div>
            <Link href="/evenements/tombola/inscription">Acheter des tickets →</Link>
          </div>

          {tombolaTickets.length === 0 ? (
            <p className="empty-state">Tu ne possèdes encore aucun ticket de tombola.</p>
          ) : (
            <div className="profile-tombola-orders">
              {[...ticketsByOrder.entries()].map(([orderNumber, items]) => (
                <article key={orderNumber} className="profile-tombola-order">
                  <header>
                    <div><small>Commande</small><strong>{orderNumber}</strong></div>
                    <span>{items.length} ticket(s)</span>
                  </header>
                  <div className="profile-ticket-numbers">
                    {items
                      .slice()
                      .sort((a, b) => a.ticket_number - b.ticket_number)
                      .map((item) => <strong key={item.id}>n° {ticket(item.ticket_number)}</strong>)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {wheelConfigured && (
        <section className="profile-data-section profile-standalone-section">
          <div className="profile-data-heading"><div><p className="eyebrow">HISTORIQUE</p><h2>Roue de la chance</h2></div><Link href="/evenements/roue-de-la-chance">Tourner la roue →</Link></div>
          <div className="profile-game-list">
            {spins.length === 0 && <p className="empty-state">Tu n’as encore effectué aucun tirage.</p>}
            {spins.map((spin) => (
              <article className={`profile-game-row profile-game-row-${spin.redemption_status}`} key={spin.id}>
                <span className="profile-game-icon">{spin.prize_type === "loss" ? "✕" : "◆"}</span>
                <div><small>{new Date(spin.awarded_at).toLocaleString("fr-FR")}</small><strong>{spin.prize_label}</strong></div>
                <span className={`wheel-gain-status wheel-gain-status-${spin.redemption_status}`}>{statusLabels[spin.redemption_status] ?? spin.redemption_status}</span>
              </article>
            ))}
          </div>
        </section>
      )}


      {bingoConfigured && (
        <section className="profile-games-section profile-bingo-section">
          <div className="profile-data-heading"><div><p className="eyebrow">BINGO</p><h2>Mes grilles actives</h2></div><span>{bingoCards.length} grille(s)</span></div>
          <p className="commerce-hint">Les numéros déjà sortis sont colorés automatiquement ici. Sur la page du jeu, tu peux aussi les cocher manuellement.</p>
          <div className="bingo-cards-grid">
            {bingoCards.length === 0 && <p className="empty-state">Tu ne possèdes aucune grille pour l’édition actuelle.</p>}
            {bingoCards.map((card) => <BingoCard key={card.id} card={card} calledNumbers={bingoDraws.map((draw) => draw.ball_number)} />)}
          </div>
        </section>
      )}
    </>
  );
}
