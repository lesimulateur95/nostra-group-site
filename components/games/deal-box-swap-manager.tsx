import { triggerDealBoxSwap } from "@/app/actions/deal-box-swap";
import { getDealBoxSwapDashboardState } from "@/lib/deal/box-swap-data";
import styles from "@/components/games/deal-box-swap.module.css";

function statusLabel(status: string): string {
  if (status === "playing") return "Partie en cours";
  if (status === "banker_call") {
    return "Offre du banquier en attente";
  }
  return status;
}

export async function DealBoxSwapManager() {
  const state = await getDealBoxSwapDashboardState();

  if (!state.configured) {
    return (
      <aside className={styles.managerDock}>
        <details>
          <summary>
            <span>☎</span>
            Changement de boîte — activation requise
          </summary>

          <div className={styles.managerBody}>
            Exécute le SQL V46 pour activer les appels de
            changement de boîte.
          </div>
        </details>
      </aside>
    );
  }

  const playableSessions = state.sessions.filter(
    (session) =>
      session.status === "playing" ||
      session.active_swap_status !== null,
  );

  return (
    <aside className={styles.managerDock}>
      <details>
        <summary>
          <span>☎</span>
          Appel du banquier — changement de boîte
          {playableSessions.length > 0 && (
            <b>{playableSessions.length}</b>
          )}
        </summary>

        <div className={styles.managerBody}>
          <div className={styles.managerIntro}>
            <span>ACCÈS GÉRANT</span>
            <h2>Proposer un changement de boîte</h2>
            <p>
              Le joueur devra choisir entre conserver sa boîte ou
              en sélectionner une nouvelle.
            </p>
          </div>

          {playableSessions.length === 0 && (
            <div className={styles.managerEmpty}>
              Aucune partie n’est actuellement disponible pour cet
              appel.
            </div>
          )}

          <div className={styles.managerSessions}>
            {playableSessions.map((session) => (
              <article
                className={styles.managerSession}
                key={session.id}
              >
                <div>
                  <span>{statusLabel(session.status)}</span>
                  <strong>{session.player_name}</strong>
                  <small>
                    Boîte actuelle :{" "}
                    {session.selected_box ?? "Non choisie"} ·{" "}
                    {session.opened_count} ouverte(s)
                  </small>
                </div>

                {session.active_swap_status ? (
                  <div className={styles.waitingChoice}>
                    {session.active_swap_status === "pending"
                      ? "Le joueur doit répondre à l’appel."
                      : "Le joueur choisit sa nouvelle boîte."}
                  </div>
                ) : (
                  <form action={triggerDealBoxSwap}>
                    <input
                      type="hidden"
                      name="session_id"
                      value={session.id}
                    />
                    <button type="submit">
                      ☎ Demander s’il veut changer
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </div>
      </details>
    </aside>
  );
}
