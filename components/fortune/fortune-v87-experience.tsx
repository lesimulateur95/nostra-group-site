import { FortuneLiveGame } from "@/components/fortune/fortune-live-game";
import { FortuneV87LiveTools } from "@/components/fortune/fortune-v87-live-tools";
import { FortuneV87ManagerTools } from "@/components/fortune/fortune-v87-manager-tools";
import type {
  FortuneCitizen,
  FortuneManagerRound,
  FortuneState,
} from "@/lib/fortune/data";
import type {
  FortuneExtraStateV87,
  FortuneHistoryItemV87,
  FortunePuzzleBankItemV87,
  FortuneSegmentV87,
} from "@/lib/fortune/v87-data";
import styles from "./fortune-v87.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function date(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function FortuneV87Experience({
  state,
  isManager,
  citizens,
  managerRounds,
  successMessage,
  errorMessage,
  puzzles,
  history,
  segments,
  initialExtra,
}: {
  state: FortuneState;
  isManager: boolean;
  citizens: FortuneCitizen[];
  managerRounds: FortuneManagerRound[];
  successMessage: string | null;
  errorMessage: string | null;
  puzzles: FortunePuzzleBankItemV87[];
  history: FortuneHistoryItemV87[];
  segments: FortuneSegmentV87[];
  initialExtra: FortuneExtraStateV87;
}) {
  return (
    <>
      <FortuneLiveGame
        state={state}
        isManager={isManager}
        citizens={citizens}
        managerRounds={managerRounds}
        successMessage={successMessage}
        errorMessage={errorMessage}
      />

      <div className={styles.extensionArea}>
        <FortuneV87LiveTools
          game={state.game}
          players={state.players}
          currentUserPosition={state.currentUserPosition}
          isManager={isManager}
          initialExtra={initialExtra}
        />

        {isManager && (
          <FortuneV87ManagerTools
            state={state}
            puzzles={puzzles}
            segments={segments}
          />
        )}

        <section className={styles.historyPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>ARCHIVES DU JEU</span>
              <h2>Anciennes parties et gagnants</h2>
            </div>
            <strong>{history.length} partie(s)</strong>
          </div>

          {history.length === 0 ? (
            <p className={styles.emptyText}>
              Aucune partie terminée n’est encore enregistrée. Les prochaines
              fins de partie seront archivées automatiquement.
            </p>
          ) : (
            <div className={styles.historyGrid}>
              {history.map((item) => (
                <article key={item.id} className={styles.historyCard}>
                  <span>{date(item.finished_at)}</span>
                  <h3>{item.winner_name || "Partie sans gagnant"}</h3>
                  <div>
                    <small>Joueurs</small>
                    <strong>{item.player_count}</strong>
                  </div>
                  <div>
                    <small>Gain enregistré</small>
                    <strong>{money(item.total_prize)}</strong>
                  </div>
                  <div>
                    <small>Résultat</small>
                    <strong>
                      {item.status === "cancelled"
                        ? "Annulée"
                        : item.final_result === "won"
                          ? "Finale gagnée"
                          : "Terminée"}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
