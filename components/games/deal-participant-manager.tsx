import {
  endDealLiveGame,
  launchDealGameForCitizen,
} from "@/app/actions/deal-live";
import { getDealLiveAdminState } from "@/lib/deal/live-data";

import styles from "./deal-live.module.css";

export async function DealParticipantManager() {
  const state = await getDealLiveAdminState();

  if (!state.configured) {
    return (
      <section className={styles.managerPanel}>
        <p className="eyebrow">V84 — PARTIE EN DIRECT</p>
        <h2>Activation Supabase nécessaire</h2>
        <p>
          Exécute le SQL V84 pour sélectionner un citoyen et ouvrir les autres
          accès uniquement en mode spectateur.
        </p>
      </section>
    );
  }

  if (!state.edition) {
    return (
      <section className={styles.managerPanel}>
        <p className="eyebrow">PARTICIPANT OFFICIEL</p>
        <h2>Crée d’abord une édition</h2>
        <p>
          Prépare les 24 gains avec le module existant, puis reviens ici pour
          sélectionner le citoyen qui jouera en direct.
        </p>
      </section>
    );
  }

  const live = Boolean(state.edition.active_session_id);

  return (
    <section className={styles.managerPanel}>
      <div className={styles.managerHeader}>
        <div>
          <p className="eyebrow">PARTIE UNIQUE EN DIRECT</p>
          <h2>Choisir le citoyen participant</h2>
          <p>
            Un seul citoyen contrôle les boîtes. Tous les autres comptes voient
            la même partie en temps réel, sans pouvoir jouer.
          </p>
        </div>
        <span className={live ? styles.liveBadge : styles.offlineBadge}>
          {live ? "EN DIRECT" : "AUCUNE PARTIE"}
        </span>
      </div>

      {live && (
        <div className={styles.currentPlayer}>
          <span>Citoyen actuellement sélectionné</span>
          <strong>{state.edition.selected_player_name}</strong>
          <small>Les autres citoyens sont automatiquement spectateurs.</small>
        </div>
      )}

      <div className={styles.managerActions}>
        <form action={launchDealGameForCitizen} className={styles.launchForm}>
          <label htmlFor="deal-citizen">Profil citoyen du site</label>
          <select
            id="deal-citizen"
            name="citizen_id"
            defaultValue={state.edition.selected_player_user_id ?? ""}
            required
          >
            <option value="" disabled>
              Sélectionner un citoyen
            </option>
            {state.citizens.map((citizen) => (
              <option key={citizen.user_id} value={citizen.user_id}>
                {citizen.display_name}
              </option>
            ))}
          </select>
          <button className={styles.primaryButton} type="submit">
            {live ? "Lancer une nouvelle partie" : "Lancer la partie"}
          </button>
        </form>

        {live && (
          <form action={endDealLiveGame}>
            <button className={styles.stopButton} type="submit">
              Arrêter et masquer la partie
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
