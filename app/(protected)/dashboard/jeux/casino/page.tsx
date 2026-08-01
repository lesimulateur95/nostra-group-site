import Link from "next/link";

import { adjustCasinoWallet, resetCasinoPlayer, saveCasinoSettings } from "@/app/actions/casino";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCasinoAdminData, getCasinoSettings } from "@/lib/casino/data";

function n(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasinoDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const [settings, admin] = await Promise.all([getCasinoSettings(), getCasinoAdminData()]);
  const recentPurchases = admin.conversions.slice(0, 30);
  const chipsInCirculation = admin.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const walletByUser = new Map(admin.wallets.map((wallet) => [wallet.userId, wallet]));

  return (
    <DashboardShell>
      <DashboardHeader eyebrow="DIRECTION · JEUX" title="Gestion du casino" description="Gère l’accès discret, la caisse, les jetons et les comptes joueurs directement depuis le Dashboard du site." />

      {!settings.configured && <section className="dashboard-setup"><span className="module-status">Activation V108 nécessaire</span><h2>Le casino reste entièrement masqué</h2><p>Exécute d’abord <strong>supabase/casino-le-cercle-v108.sql</strong>, puis le correctif <strong>supabase/casino-paiements-rp-reinitialisations-v109.sql</strong>. Tant que le premier SQL n’est pas exécuté, aucun citoyen ne voit le bouton Casino.</p></section>}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">La gestion du casino a bien été mise à jour.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">L’opération n’a pas pu être enregistrée. {params.error === "setup" ? "Vérifie que les SQL V108 et V109 ont bien été exécutés." : params.error === "reset" ? "La réinitialisation a été bloquée. Vérifie la confirmation ou termine d’abord la partie active du joueur." : "Vérifie les valeurs saisies."}</div>}

      <section className="dashboard-kpi-grid">
        <article><span>Accès accueil</span><strong>{settings.publicEnabled ? "VISIBLE" : "MASQUÉ"}</strong></article>
        <article><span>Citoyens sélectionnables</span><strong>{admin.citizens.length}</strong></article>
        <article><span>Jetons en circulation</span><strong>{n(chipsInCirculation)}</strong></article>
        <article><span>Joueurs enregistrés</span><strong>{admin.wallets.length}</strong></article>
      </section>

      <section className="tombola-dashboard-controls">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">♠</span><div><h2>Accès discret</h2><p>Masqué retire le bouton de l’accueil et bloque l’adresse aux citoyens. La Direction conserve l’accès de préparation.</p></div></div>
          <form action={saveCasinoSettings} className="tombola-settings-form">
            <label><span>Visibilité</span><select name="public_enabled" defaultValue={settings.publicEnabled ? "true" : "false"}><option value="false">Masqué — privé Direction</option><option value="true">Visible — ouvert aux citoyens</option></select></label>
            <label><span>Nom du casino</span><input name="name" defaultValue={settings.name} maxLength={80} required /></label>
            <label><span>Sous-titre</span><input name="subtitle" defaultValue={settings.subtitle} maxLength={120} /></label>
            <label><span>Valeur RP d’un jeton (€)</span><input name="rp_per_chip" type="number" min="1" defaultValue={settings.rpPerChip} required /></label>
            <label><span>Conversion minimum (jetons)</span><input name="min_conversion" type="number" min="1" defaultValue={settings.minConversion} required /></label>
            <label><span>Conversion maximum (jetons)</span><input name="max_conversion" type="number" min="1" defaultValue={settings.maxConversion} required /></label>
            <button className="btn" type="submit">Enregistrer les réglages</button>
          </form>
          <Link className="secondary-link-button" href="/casino">Prévisualiser le casino →</Link>
        </article>

        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">◉</span><div><h2>Ajustement manuel</h2><p>Crédite ou retire des jetons à un citoyen. Chaque mouvement est enregistré dans le journal du casino.</p></div></div>
          <form action={adjustCasinoWallet} className="tombola-settings-form">
            <label><span>Citoyen</span><select name="user_id" required><option value="">Choisir un compte</option>{admin.citizens.map((citizen) => { const wallet = walletByUser.get(citizen.userId); return <option value={citizen.userId} key={citizen.userId}>{citizen.displayName} · {n(wallet?.balance ?? 0)} jetons</option>; })}</select></label>
            <label><span>Montant (+ pour créditer, − pour retirer)</span><input name="amount" type="number" step="1" required /></label>
            <label><span>Motif obligatoire</span><input name="reason" maxLength={180} placeholder="Correction, gain événement, remboursement…" required /></label>
            <button className="btn" type="submit">Enregistrer le mouvement</button>
          </form>
        </article>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">💶</span><div><h2>Achats avec l’argent RP</h2><p>Le débit sur le compte du serveur et le crédit des jetons sont maintenant automatiques. Aucun jeton n’est créé si le paiement RP échoue.</p></div></div>
        <div className="orders-list">
          {recentPurchases.length === 0 && <p className="empty-state">Aucun achat enregistré pour le moment.</p>}
          {recentPurchases.map((item) => (
            <article className="order-card" key={item.id}>
              <div><span className="module-status">{item.status === "approved" ? "PAYÉ" : item.status === "rejected" ? "REFUSÉ" : item.status === "cancelled" ? "ANNULÉ" : "À VÉRIFIER"}</span><h3>{item.citizenName}</h3><p>{n(item.rpAmount)} € RP → <strong>{n(item.chipAmount)} jetons</strong></p><small>{new Date(item.createdAt).toLocaleString("fr-FR")}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">👤</span><div><h2>Portefeuilles joueurs</h2><p>Vue complète des soldes et de l’activité du Cercle.</p></div></div>
        <div className="tombola-ticket-table">
          {admin.wallets.length === 0 && <p className="empty-state">Les comptes apparaîtront à la première ouverture du casino.</p>}
          {admin.wallets.map((wallet) => (
            <article key={wallet.userId}>
              <strong>{wallet.displayName}</strong>
              <span>{n(wallet.balance)} jetons · niveau {wallet.level}</span>
              <small>{n(wallet.gamesPlayed)} parties · record {n(wallet.biggestWin)} · {n(wallet.xp)} XP</small>
              <details className="tombola-reset-confirmation">
                <summary className="danger-link-button">Réinitialiser ce joueur</summary>
                <div className="order-actions">
                  <form action={resetCasinoPlayer}><input type="hidden" name="user_id" value={wallet.userId} /><input type="hidden" name="scope" value="balance" /><input type="hidden" name="confirmation" value="REMETTRE LE SOLDE A ZERO" /><p>Retire tous les jetons, sans effacer le niveau ni les statistiques.</p><button className="danger-link-button" type="submit">Solde à zéro</button></form>
                  <form action={resetCasinoPlayer}><input type="hidden" name="user_id" value={wallet.userId} /><input type="hidden" name="scope" value="level" /><input type="hidden" name="confirmation" value="REMETTRE LE NIVEAU A ZERO" /><p>Remet uniquement l’XP à zéro et le joueur au niveau 1.</p><button className="danger-link-button" type="submit">Niveau à zéro</button></form>
                  <form action={resetCasinoPlayer}><input type="hidden" name="user_id" value={wallet.userId} /><input type="hidden" name="scope" value="total" /><input type="hidden" name="confirmation" value="REINITIALISER LE JOUEUR" /><p>Efface le solde, l’XP et toutes les statistiques Casino du joueur.</p><button className="danger-link-button" type="submit">Réinitialisation totale</button></form>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
