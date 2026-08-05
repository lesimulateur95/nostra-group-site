import { deleteWheelGain, updateWheelGainStatus } from "@/app/actions/games";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { WheelSettingsEditor } from "@/components/games/wheel-settings-editor";
import { getWheelConfiguration, getWheelSpins } from "@/lib/backoffice/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = { unused: "Pas encore utilisé", used: "Utilisé", lost: "Perdu" };

const configurationErrors: Record<string, string> = {
  authorization: "Ton compte est bien Gérant sur le site, mais Supabase n’a pas encore appliqué le correctif de droits V136.3.",
  message: "Le message de fermeture doit contenir entre 1 et 500 caractères.",
  count: "La roue doit contenir entre 2 et 40 cases.",
  segment: "Une case est incomplète. Vérifie son gain, son texte court, son résultat et ses couleurs.",
  setup: "La configuration SQL de la roue est incomplète. Exécute le correctif V136.3.",
  database: "Supabase a refusé l’enregistrement. Exécute le correctif V136.3 puis reconnecte-toi au site.",
  configuration: "Une case est incomplète. Vérifie chaque champ avant d’enregistrer.",
};

export default async function WheelDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; configuration_saved?: string; error?: string }> }) {
  const params = await searchParams;
  const configuration = await getWheelConfiguration();
  const configured = configuration.configured;
  const spins = configured ? await getWheelSpins() : [];
  const unused = spins.filter((spin) => spin.redemption_status === "unused").length;
  const used = spins.filter((spin) => spin.redemption_status === "used").length;
  const losses = spins.filter((spin) => spin.redemption_status === "lost").length;

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader eyebrow="JEUX NOSTRA GROUP" title="Roue de la chance" description="Modifie les cases, ouvre ou ferme la roue et consulte tous les tirages." />
      {!configured && <section className="dashboard-setup"><span className="module-status">Mise à jour nécessaire</span><h2>Installer la configuration personnalisable</h2><p>Exécute le fichier SQL V136.3 fourni avec le correctif pour pouvoir modifier les cases et l’ouverture de la roue.</p></section>}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le statut du gain a été mis à jour.</div>}
      {params.deleted && <div className="dashboard-feedback dashboard-feedback-success">Le gain a été retiré de l’historique et du profil du citoyen. Son tirage quotidien reste consommé.</div>}
      {params.configuration_saved && <div className="dashboard-feedback dashboard-feedback-success">La roue, ses cases et son état d’ouverture ont été enregistrés.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">{configurationErrors[params.error] ?? "L’opération n’a pas pu être enregistrée."}</div>}

      {configured && <>
        <WheelSettingsEditor enabled={configuration.enabled} disabledMessage={configuration.disabledMessage} initialSegments={configuration.segments} />
        <section className="dashboard-kpi-grid wheel-dashboard-kpis">
          <article><span>État citoyen</span><strong>{configuration.enabled ? "Activée" : "Désactivée"}</strong></article>
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
                <details className="wheel-delete-confirmation">
                  <summary className="danger-link-button wheel-delete-button">Supprimer ce gain</summary>
                  <form action={deleteWheelGain} className="wheel-delete-confirmation-form">
                    <input type="hidden" name="id" value={spin.id} />
                    <input type="hidden" name="delete_confirmation" value="SUPPRIMER_CE_GAIN" />
                    <p>Confirmer la suppression de ce gain ?</p>
                    <button className="danger-link-button wheel-delete-button" type="submit">
                      Oui, supprimer définitivement
                    </button>
                  </form>
                </details>
              </div>
            </article>)}
          </div>
        </section>
      </>}
    </DashboardShell>
  );
}
