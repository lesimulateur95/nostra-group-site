
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  finishRaceControlEntry,
  markRaceControlEntryDnf,
  publishRaceControlResults,
  unpublishRaceControlResults,
  recordRaceControlLap,
  startRaceControlEvent,
  stopRaceControlEvent,
  type RaceControlActionResult,
} from "@/app/actions/race-control";
import type { RaceEventState } from "@/lib/race-control/types";
import styles from "./race-control.module.css";

function pad(value: number, size = 2): string {
  return Math.max(0, value).toString().padStart(size, "0");
}

export function formatRaceTime(
  milliseconds: number | null,
  showHours = false,
): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) {
    return "—";
  }

  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;

  if (showHours || hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(
      millis,
      3,
    )}`;
  }

  return `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

function actionError(error?: string): string {
  switch (error) {
    case "auth":
      return "La session a expiré. Reconnecte-toi.";
    case "access":
      return "Accès réservé aux commissaires et au Gérant.";
    case "status":
    case "entry_status":
      return "Cette action n’est plus disponible à cette étape.";
    case "finish":
      return "Le pilote entre dans son dernier tour : utilise le bouton rouge Arrivée au prochain passage.";
    case "laps_remaining":
      return "Le pilote n’a pas encore atteint son dernier tour.";
    case "duplicate":
      return "Passage ignoré : le bouton a été pressé deux fois trop rapidement.";
    case "lap":
      return "Le temps de passage reçu n’est pas valide.";
    default:
      return "L’action n’a pas pu être enregistrée.";
  }
}

function competitionLabel(value: string): string {
  if (value === "f1") return "Championnat F1";
  if (value === "gt3rs") return "Championnat GT3 RS";
  return "Course libre";
}

function statusLabel(value: string): string {
  switch (value) {
    case "ready":
      return "Prêt";
    case "running":
      return "En course";
    case "finished":
      return "Arrivé";
    case "dnf":
      return "Abandon";
    case "published":
      return "Résultats publiés";
    default:
      return value;
  }
}

function LiveRaceClock({
  startedAt,
  fixedMs,
  running,
  clockOffset,
}: {
  startedAt: string | null;
  fixedMs: number;
  running: boolean;
  clockOffset: { current: number };
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || !startedAt) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  const elapsed =
    running && startedAt
      ? Math.max(
          0,
          now + clockOffset.current - Date.parse(startedAt),
        )
      : Math.max(0, fixedMs);

  return <>{formatRaceTime(elapsed, true)}</>;
}

export function RaceTimingConsole({
  initialState,
}: {
  initialState: RaceEventState;
}) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const clockOffset = useRef(
    Date.parse(initialState.server_now) - Date.now(),
  );
  const refreshInFlight = useRef(false);
  const refreshAbort = useRef<AbortController | null>(null);
  const refreshSequence = useRef(0);
  const eventId = state.event?.id ?? null;

  const refresh = useCallback(
    async (force = false) => {
      if (!eventId) return;

      if (refreshInFlight.current) {
        if (!force) return;
        refreshAbort.current?.abort();
      }

      const controller = new AbortController();
      const sequence = refreshSequence.current + 1;
      refreshSequence.current = sequence;
      refreshAbort.current = controller;
      refreshInFlight.current = true;

      try {
        const response = await fetch(`/api/race-control/${eventId}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) return;

        const nextState = (await response.json()) as RaceEventState;

        if (
          sequence !== refreshSequence.current ||
          nextState.event?.id !== eventId ||
          !Array.isArray(nextState.entries)
        ) {
          return;
        }

        const serverNow = Date.parse(nextState.server_now);
        if (Number.isFinite(serverNow)) {
          clockOffset.current = serverNow - Date.now();
        }

        setState(nextState);
      } catch (refreshError) {
        if (
          !(
            refreshError instanceof DOMException &&
            refreshError.name === "AbortError"
          )
        ) {
          // Le chrono local continue pendant une coupure réseau brève.
        }
      } finally {
        if (sequence === refreshSequence.current) {
          refreshInFlight.current = false;
          refreshAbort.current = null;
        }
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (!eventId) return;

    const interval =
      state.event?.status === "running" ? 2_000 : 4_000;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(false);
      }
    }, interval);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [eventId, refresh, state.event?.status]);

  useEffect(() => {
    return () => {
      refreshAbort.current?.abort();
    };
  }, []);

  const getCurrentElapsed = useCallback(() => {
    const currentEvent = state.event;
    if (!currentEvent?.started_at) return 0;

    if (
      currentEvent.status !== "running" &&
      currentEvent.completed_at
    ) {
      return Math.max(
        0,
        Date.parse(currentEvent.completed_at) -
          Date.parse(currentEvent.started_at),
      );
    }

    return Math.max(
      0,
      Date.now() + clockOffset.current -
        Date.parse(currentEvent.started_at),
    );
  }, [state.event]);

  const runAction = async (
    key: string,
    action: () => Promise<RaceControlActionResult>,
  ) => {
    if (pendingAction) return;

    setError(null);
    setPendingAction(key);

    try {
      const result = await action();

      if (!result.ok) {
        setError(actionError(result.error));
        return;
      }

      await refresh(true);
    } catch {
      setError("L’action n’a pas pu être enregistrée.");
    } finally {
      setPendingAction(null);
    }
  };

  const isPending = pendingAction !== null;

  const sortedEntries = useMemo(() => {
    if (
      state.event?.status === "finished" ||
      state.event?.status === "published"
    ) {
      return [...state.entries].sort(
        (left, right) =>
          (left.position ?? 999) - (right.position ?? 999),
      );
    }

    return [...state.entries].sort(
      (left, right) => left.grid_position - right.grid_position,
    );
  }, [state.entries, state.event?.status]);

  if (!state.configured || !state.event) {
    return (
      <section className={styles.setupWarning}>
        <h2>Course introuvable</h2>
        <p>
          Le module doit être activé ou cette course n’existe plus.
        </p>
      </section>
    );
  }

  const event = state.event;
  const completedEntries = state.entries.filter(
    (entry) =>
      entry.status === "finished" || entry.status === "dnf",
  );

  return (
    <section className={styles.console}>
      <header className={styles.consoleHeader}>
        <div>
          <span className={styles.sectionLabel}>
            DIRECTION DE COURSE
          </span>
          <h1>{event.title}</h1>
          <p>
            {competitionLabel(event.competition_type)} ·{" "}
            {event.target_laps} tour
            {event.target_laps > 1 ? "s" : ""} ·{" "}
            {state.entries.length} pilote
            {state.entries.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className={styles.masterClock}>
          <span>CHRONOMÈTRE GÉNÉRAL</span>
          <strong>
            <LiveRaceClock
              startedAt={event.started_at}
              fixedMs={
                event.status === "ready" ? 0 : getCurrentElapsed()
              }
              running={event.status === "running"}
              clockOffset={clockOffset}
            />
          </strong>
          <small>
            {event.status === "finished"
              ? "Course terminée"
              : event.status === "published"
                ? "Résultats publiés"
                : statusLabel(event.status)}
          </small>

          <button
            className={styles.masterClockStopButton}
            disabled={event.status !== "running" || isPending}
            type="button"
            onClick={() =>
              void runAction("stop-event", () =>
                stopRaceControlEvent(event.id),
              )
            }
          >
            {event.status === "running"
              ? "■ Arrêter le chrono général"
              : event.status === "ready"
                ? "■ Chrono non lancé"
                : "■ Chrono général arrêté"}
          </button>
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.raceControls}>
        {event.status === "ready" && (
          <div className={styles.generalClockButtons}>
            <button
              className={styles.startButton}
              disabled={isPending}
              type="button"
              onClick={() =>
                void runAction("start-event", () =>
                  startRaceControlEvent(event.id),
                )
              }
            >
              ▶ Lancer le départ et tous les chronomètres
            </button>
          </div>
        )}

        {event.status === "ready" && (
          <p>
            Le bouton de départ lance simultanément le chronomètre
            général et tous les chronomètres des pilotes.
          </p>
        )}

        {event.status === "running" && (
          <>
            <div className={styles.liveIndicator}>
              <span />
              COURSE EN DIRECT
            </div>
            <p>
              À chaque passage, appuie sur <strong>+1 tour</strong>.
              Au dernier passage, utilise le bouton rouge{" "}
              <strong>Arrivée</strong>. Le bouton rouge du chrono
              général arrête toute la course et classe les pilotes
              encore en piste en abandon.
            </p>
          </>
        )}

        {(event.status === "finished" ||
          event.status === "published") && (
          <div className={styles.finishedSummary}>
            <strong>
              {completedEntries.length}/{state.entries.length}
            </strong>
            <span>pilotes classés — calcul automatique terminé</span>
          </div>
        )}
      </section>

      {state.best_lap && (
        <section className={styles.bestLapBanner}>
          <span>⚡ MEILLEUR TOUR DE LA COURSE</span>
          <strong>
            {formatRaceTime(state.best_lap.lap_time_ms)}
          </strong>
          <p>
            {state.best_lap.driver_name} ·{" "}
            {state.best_lap.team_name} · Tour{" "}
            {state.best_lap.lap_number}
          </p>
        </section>
      )}

      <div className={styles.timingGrid}>
        {sortedEntries.map((entry) => {
          const canRecordLap =
            event.status === "running" &&
            entry.status === "running" &&
            entry.lap_count < event.target_laps - 1;

          const canFinish =
            event.status === "running" &&
            entry.status === "running" &&
            entry.lap_count >= event.target_laps - 1;

          const elapsedForEntry =
            entry.total_time_ms ??
            (entry.finished_at && event.started_at
              ? Date.parse(entry.finished_at) -
                Date.parse(event.started_at)
              : 0);

          return (
            <article
              className={`${styles.driverCard} ${
                entry.status === "finished"
                  ? styles.driverFinished
                  : entry.status === "dnf"
                    ? styles.driverDnf
                    : ""
              }`}
              key={entry.id}
            >
              <header className={styles.driverHeader}>
                <span className={styles.gridPosition}>
                  {entry.position ?? entry.grid_position}
                </span>
                <div>
                  <h2>{entry.driver_name}</h2>
                  <p>{entry.team_name}</p>
                </div>
                <span className={styles.entryStatus}>
                  {statusLabel(entry.status)}
                </span>
              </header>

              <div className={styles.driverClock}>
                <span>CHRONOMÈTRE</span>
                <strong>
                  <LiveRaceClock
                    startedAt={event.started_at}
                    fixedMs={
                      event.status === "ready"
                        ? 0
                        : elapsedForEntry
                    }
                    running={
                      event.status === "running" &&
                      entry.status === "running"
                    }
                    clockOffset={clockOffset}
                  />
                </strong>
              </div>

              <div className={styles.lapStats}>
                <div>
                  <span>TOURS</span>
                  <strong>
                    {entry.lap_count}/{event.target_laps}
                  </strong>
                </div>
                <div>
                  <span>DERNIER TOUR</span>
                  <strong>
                    {formatRaceTime(entry.last_lap_ms)}
                  </strong>
                </div>
                <div>
                  <span>MEILLEUR TOUR</span>
                  <strong>
                    {formatRaceTime(entry.best_lap_ms)}
                  </strong>
                </div>
              </div>

              {entry.laps.length > 0 && (
                <details className={styles.lapHistory}>
                  <summary>
                    Voir les {entry.laps.length} temps enregistrés
                  </summary>
                  <ol>
                    {entry.laps.map((lap) => (
                      <li key={lap.id}>
                        <span>Tour {lap.lap_number}</span>
                        <strong>
                          {formatRaceTime(lap.lap_time_ms)}
                        </strong>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {event.status === "running" &&
                entry.status === "running" && (
                  <div className={styles.driverActions}>
                    <button
                      className={styles.lapButton}
                      disabled={!canRecordLap || isPending}
                      type="button"
                      onClick={() =>
                        void runAction(`lap-${entry.id}`, () =>
                          recordRaceControlLap(
                            entry.id,
                            getCurrentElapsed(),
                          ),
                        )
                      }
                    >
                      +1 tour
                    </button>

                    <button
                      className={styles.finishButton}
                      disabled={!canFinish || isPending}
                      type="button"
                      onClick={() =>
                        void runAction(`finish-${entry.id}`, () =>
                          finishRaceControlEntry(
                            entry.id,
                            getCurrentElapsed(),
                          ),
                        )
                      }
                    >
                      🏁 Arrivée
                    </button>

                    <button
                      className={styles.dnfButton}
                      disabled={isPending}
                      type="button"
                      onClick={() =>
                        void runAction(`dnf-${entry.id}`, () =>
                          markRaceControlEntryDnf(
                            entry.id,
                            getCurrentElapsed(),
                          ),
                        )
                      }
                    >
                      Abandon
                    </button>
                  </div>
                )}

              {entry.status === "finished" && (
                <footer className={styles.finalEntryResult}>
                  <span>Temps final</span>
                  <strong>
                    {formatRaceTime(entry.total_time_ms, true)}
                  </strong>
                  <small>
                    {entry.championship_points} point
                    {entry.championship_points > 1 ? "s" : ""}
                  </small>
                </footer>
              )}

              {entry.status === "dnf" && (
                <footer className={styles.finalEntryResult}>
                  <span>Résultat</span>
                  <strong>ABANDON</strong>
                  <small>{entry.lap_count} tour(s) terminé(s)</small>
                </footer>
              )}
            </article>
          );
        })}
      </div>

      {(event.status === "finished" ||
        event.status === "published") && (
        <section className={styles.publishPanel}>
          <div>
            <span className={styles.sectionLabel}>
              PUBLICATION OFFICIELLE
            </span>
            <h2>Envoyer les résultats dans les classements</h2>
            <p>
              Le site attribue automatiquement les points aux dix
              premiers : 25, 18, 15, 12, 10, 8, 6, 4, 2 et 1.
              Les classements pilotes et écuries sont recalculés à
              partir des courses publiées.
            </p>
          </div>

          <form
            action={publishRaceControlResults}
            className={styles.publishForm}
          >
            <input type="hidden" name="event_id" value={event.id} />
            <label>
              Destination
              <select
                name="destination"
                defaultValue={event.competition_type}
              >
                <option value="f1">
                  Résultats et classement F1
                </option>
                <option value="gt3rs">
                  Résultats et classement GT3 RS
                </option>
                <option value="general">
                  Historique interne uniquement
                </option>
              </select>
            </label>
            <button className={styles.primaryButton} type="submit">
              {event.status === "published"
                ? "Mettre à jour la publication"
                : "Publier les résultats"}
            </button>
          </form>

          {event.status === "published" && (
            <form
              action={unpublishRaceControlResults}
              className={styles.unpublishForm}
            >
              <input type="hidden" name="event_id" value={event.id} />
              <p>
                Cette action retire uniquement cette course des pages
                publiques et des classements. Les chronos et les tours
                restent sauvegardés.
              </p>
              <button className={styles.unpublishButton} type="submit">
                Retirer cette course des classements
              </button>
            </form>
          )}

          {event.status === "published" &&
            event.competition_type !== "general" && (
              <div className={styles.publicLinks}>
                <Link
                  href={`/circuit/championnat-${event.competition_type}/resultats`}
                >
                  Voir les résultats publics →
                </Link>
                <Link
                  href={`/circuit/classement/${event.competition_type}`}
                >
                  Voir le classement pilotes →
                </Link>
                <Link href="/circuit/classement/ecuries">
                  Voir le classement des écuries →
                </Link>
              </div>
            )}
        </section>
      )}
    </section>
  );
}
