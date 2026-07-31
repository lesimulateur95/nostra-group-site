import Link from "next/link";

import { adjustCasinoWallet, reviewCasinoConversion, saveCasinoSettings } from "@/app/actions/casino";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCasinoAdminData, getCasinoSettings } from "@/lib/casino/data";

function n(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasinoDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const [settings, admin] = await Promise.all([getCasinoSettings(), getCasinoAdminData()]);
  const pending = admin.conversions.filter((item) => item.status === "pending");
  const chipsInCirculation = admin.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

  return (
    <DashboardShell>
      <DashboardHeader eyebrow="DIRECTION · JEUX" title="Gestion du casino" description="Gère l’accès discret, la caisse, les jetons et les comptes joueurs directement depuis le Dashboard du site." />

      {!settings.configured && <section className="dashboard-setup"><span className="module-status">Activation V108 nécessaire</span><h2>Le casino reste entièrement masqué</h2><p>Exécute une seule fois <strong>supabase/casino-le-cercle-v108.sql</strong>. Tant que ce SQL n’est pas exécuté, aucun citoyen ne voit le bouton Casino.</p></section>}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">La gestion du casino a bien été mise à jour.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">L’opération n’a pas pu être enregistrée. {params.error === "setup" ? "Vérifie que le SQL V108 a bien été exécuté." : "Vérifie les valeurs saisies."}</div>}

      <section className="dashboard-kpi-grid">
        <article><span>Accès accueil</span><strong>{settings.publicEnabled ? "VISIBLE" : "MASQUÉ"}</strong></article>
        <article><span>Demandes de caisse</span><strong>{pending.length}</strong></article>
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
            <label><span>Citoyen</span><select name="user_id" required><option value="">Choisir un compte</option>{admin.wallets.map((wallet) => <option value={wallet.userId} key={wallet.userId}>{wallet.displayName} · {n(wallet.balance)} jetons</option>)}</select></label>
            <label><span>Montant (+ pour créditer, − pour retirer)</span><input name="amount" type="number" step="1" required /></label>
            <label><span>Motif obligatoire</span><input name="reason" maxLength={180} placeholder="Correction, gain événement, remboursement…" required /></label>
            <button className="btn" type="submit">Enregistrer le mouvement</button>
          </form>
        </article>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">💶</span><div><h2>Demandes de conversion</h2><p>Valide uniquement après avoir vérifié l’argent RP du citoyen. La validation crédite immédiatement les jetons.</p></div></div>
        <div className="orders-list">
          {pending.length === 0 && <p className="empty-state">Aucune demande en attente.</p>}
          {pending.map((item) => (
            <article className="order-card" key={item.id}>
              <div><span className="module-status">EN ATTENTE</span><h3>{item.citizenName}</h3><p>{n(item.rpAmount)} € RP → <strong>{n(item.chipAmount)} jetons</strong></p><small>{new Date(item.createdAt).toLocaleString("fr-FR")}</small></div>
              <div className="order-actions">
                <form action={reviewCasinoConversion}><input type="hidden" name="request_id" value={item.id} /><input type="hidden" name="decision" value="approved" /><button className="btn" type="submit">Valider et créditer</button></form>
                <form action={reviewCasinoConversion}><input type="hidden" name="request_id" value={item.id} /><input type="hidden" name="decision" value="rejected" /><button className="danger-link-button" type="submit">Refuser</button></form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">👤</span><div><h2>Portefeuilles joueurs</h2><p>Vue complète des soldes et de l’activité du Cercle.</p></div></div>
        <div className="tombola-ticket-table">
          {admin.wallets.length === 0 && <p className="empty-state">Les comptes apparaîtront à la première ouverture du casino.</p>}
          {admin.wallets.map((wallet) => <article key={wallet.userId}><strong>{wallet.displayName}</strong><span>{n(wallet.balance)} jetons</span><small>{n(wallet.gamesPlayed)} parties · record {n(wallet.biggestWin)}</small></article>)}
        </div>
      </section>
    </DashboardShell>
  );
}
