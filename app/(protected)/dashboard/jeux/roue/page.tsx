import { deleteWheelGain, updateWheelGainStatus } from "@/app/actions/games";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getWheelModuleConfigured, getWheelSpins } from "@/lib/backoffice/data";
import { GAMES_SETUP_SQL } from "@/lib/backoffice/games-setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = { unused: "Pas encore utilisé", used: "Utilisé", lost: "Perdu" };

export default async function WheelDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; error?: string }> }) {
  const params = await searchParams;
  const configured = await getWheelModuleConfigured();
  const spins = configured ? await getWheelSpins() : [];
  const unused = spins.filter((spin) => spin.redemption_status === "unused").length;
  const used = spins.filter((spin) => spin.redemption_status === "used").length;
  const losses = spins.filter((spin) => spin.redemption_status === "lost").length;

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader eyebrow="JEUX NOSTRA GROUP" title="Roue de la chance" description="Consulte les tirages, modifie leur statut ou retire un gain du profil du citoyen." />
      {!configured && <section className="dashboard-setup"><span className="module-status">Activation nécessaire</span><h2>Activer la roue et l’historique</h2><details><summary>Afficher le code SQL</summary><pre>{GAMES_SETUP_SQL}</pre></details></section>}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le statut du gain a été mis à jour.</div>}
      {params.deleted && <div className="dashboard-feedback dashboard-feedback-success">Le gain a été retiré de l’historique et du profil du citoyen. Son tirage quotidien reste consommé.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">L’opération n’a pas pu être enregistrée. Vérifie que le SQL V30 est activé.</div>}

      {configured && <>
        <section className="dashboard-kpi-grid wheel-dashboard-kpis">
          <article><span>Tirages visibles</span><strong>{spins.length}</strong></article>
          <article><span>Gains à utiliser</span><strong>{unused}</strong></article>
          <article><span>Gains utilisés</span><strong>{used}</strong></article>
          <article><span>Cases Perdu</span><strong>{losses}</strong></article>
        </section>
        <section className="backoffice-panel wheel-dashboard-panel">
          <div className="panel-heading"><span className="panel-icon">🎡</span><div><h2>Historique complet</h2><p>Un gain retiré disparaît aussi du profil, sans rendre un deuxième tirage disponible le même jour.</p></div></div>
          <div className="wheel-dashboard-list">
            {spins.length === 0 && <p className="empty-state">Aucun tirage enregistré pour le moment.</p>}
            {spins.map((spin) => <article className={`wheel-dashboard-row ${spin.prize_type === "loss" ? "wheel-dashboard-row-loss" : ""}`} key={spin.id}>
              <div className="wheel-dashboard-player"><span>{spin.prize_type === "loss" ? "✕" : "◆"}</span><div><strong>{spin.player_name}</strong><small>{new Date(spin.awarded_at).toLocaleString("fr-FR")}</small></div></div>
              <div className="wheel-dashboard-prize"><span>Résultat</span><strong>{spin.prize_label}</strong></div>
              <div className="wheel-dashboard-status"><span>Statut</span><strong className={`wheel-gain-status wheel-gain-status-${spin.redemption_status}`}>{statusLabels[spin.redemption_status] ?? spin.redemption_status}</strong></div>
              <div className="wheel-dashboard-actions">
                {spin.prize_type === "bonus" ? <form action={updateWheelGainStatus} className="wheel-status-form"><input type="hidden" name="id" value={spin.id} /><select name="status" defaultValue={spin.redemption_status === "used" ? "used" : "unused"}><option value="unused">Pas encore utilisé</option><option value="used">Utilisé</option></select><button className="btn" type="submit">Enregistrer</button></form> : <span className="wheel-loss-static">Aucune utilisation</span>}
                <form action={deleteWheelGain}><input type="hidden" name="id" value={spin.id} /><button className="danger-link-button wheel-delete-button" type="submit">Supprimer ce gain</button></form>
              </div>
            </article>)}
          </div>
        </section>
      </>}
    </DashboardShell>
  );
}
