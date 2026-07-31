
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  finishRaceControlEntry,
  markRaceControlEntryDnf,
  publishRaceControlResults,
  unpublishRaceControlResults,
  recordRaceControlLap,
  startRaceControlEvent,
  stopRaceControlEntry,
  stopRaceControlEvent,
  toggleRaceControlPitStop,
  type RaceControlActionResult,
} from "@/app/actions/race-control";
import type { RaceEntry, RaceEventState } from "@/lib/race-control/types";
import styles from "./race-control.module.css";

type RaceControlBasePath =
  | "/dashboard/commissaires/chronometrage"
  | "/commissaires/chronometrage";

const REFRESH_TIMEOUT_MS = 6_000;
const SHARED_CLOCK_INTERVAL_MS = 250;
const sharedClockListeners = new Set<() => void>();
let sharedClockNow = Date.now();
let sharedClockTimer: number | null = null;

function emitSharedClock() {
  sharedClockNow = Date.now();
  sharedClockListeners.forEach((listener) => listener());
}

function subscribeSharedClock(listener: () => void) {
  sharedClockListeners.add(listener);

  if (sharedClockTimer === null) {
    emitSharedClock();
    sharedClockTimer = window.setInterval(
      emitSharedClock,
      SHARED_CLOCK_INTERVAL_MS,
    );
  }

  return () => {
    sharedClockListeners.delete(listener);

    if (sharedClockListeners.size === 0 && sharedClockTimer !== null) {
      window.clearInterval(sharedClockTimer);
      sharedClockTimer = null;
    }
  };
}

function subscribeStoppedClock() {
  return () => undefined;
}

function getSharedClockSnapshot() {
  return sharedClockNow;
}

function getStoppedClockSnapshot() {
  return 0;
}

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
    case "stopped":
      return "Chrono arrêté";
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
  const now = useSyncExternalStore(
    running ? subscribeSharedClock : subscribeStoppedClock,
    running ? getSharedClockSnapshot : getStoppedClockSnapshot,
    getStoppedClockSnapshot,
  );

  const elapsed =
    running && startedAt
      ? Math.max(
          0,
          now + clockOffset.current - Date.parse(startedAt),
        )
      : Math.max(0, fixedMs);

  return <>{formatRaceTime(elapsed, true)}</>;
}

function LivePitClock({
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
  const now = useSyncExternalStore(
    running ? subscribeSharedClock : subscribeStoppedClock,
    running ? getSharedClockSnapshot : getStoppedClockSnapshot,
    getStoppedClockSnapshot,
  );

  const elapsed =
    running && startedAt
      ? Math.max(
          0,
          now + clockOffset.current - Date.parse(startedAt),
        )
      : Math.max(0, fixedMs);

  return <>{formatRaceTime(elapsed)}</>;
}

export function RaceTimingConsole({
  initialState,
  basePath,
}: {
  initialState: RaceEventState;
  basePath: RaceControlBasePath;
}) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingActionRef = useRef<Set<string>>(new Set());
  const clockOffset = useRef(
    Date.parse(initialState.server_now) - Date.now(),
  );
  const refreshInFlight = useRef(false);
  const refreshAbort = useRef<AbortController | null>(null);
  const refreshSequence = useRef(0);
  const eventId = state.event?.id ?? null;

  const refresh = useCallback(
    async (force = false) => {
      if (!eventId || pendingActionRef.current.size > 0) return;

      if (refreshInFlight.current) {
        if (!force) return;
        refreshAbort.current?.abort();
      }

      const controller = new AbortController();
      const sequence = refreshSequence.current + 1;
      refreshSequence.current = sequence;
      refreshAbort.current = controller;
      refreshInFlight.current = true;
      const timeout = window.setTimeout(
        () => controller.abort(),
        REFRESH_TIMEOUT_MS,
      );

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

        setState((currentState) => {
          if (
            currentState.event?.id === nextState.event?.id &&
            currentState.event?.status === "running" &&
            nextState.event?.status === "ready"
          ) {
            return currentState;
          }

          return nextState;
        });
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
        window.clearTimeout(timeout);

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

  const setPending = (key: string, value: boolean) => {
    if (value) {
      pendingActionRef.current.add(key);
    } else {
      pendingActionRef.current.delete(key);
    }

    setPendingActions(new Set(pendingActionRef.current));
  };

  const updateEntryOptimistically = (
    entryId: number,
    updater: (entry: RaceEntry) => RaceEntry,
  ) => {
    let previousEntry: RaceEntry | null = null;

    setState((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry;
        previousEntry = entry;
        return updater(entry);
      }),
    }));

    return () => {
      if (!previousEntry) return;

      setState((current) => ({
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === entryId ? previousEntry! : entry,
        ),
      }));
    };
  };

  const runAction = async (
    key: string,
    action: () => Promise<RaceControlActionResult>,
    options?: {
      exclusive?: boolean;
      optimistic?: () => void | (() => void);
      onSuccess?: () => void;
    },
  ) => {
    if (
      pendingActionRef.current.has(key) ||
      (options?.exclusive && pendingActionRef.current.size > 0) ||
      (!options?.exclusive && pendingActionRef.current.has("stop-event"))
    ) {
      return;
    }

    setError(null);
    setPending(key, true);
    const rollback = options?.optimistic?.();
    let succeeded = false;

    try {
      const result = await action();

      if (!result.ok) {
        rollback?.();
        setError(actionError(result.error));
        return;
      }

      succeeded = true;
      options?.onSuccess?.();
    } catch {
      rollback?.();
      setError("L’action n’a pas pu être enregistrée.");
    } finally {
      setPending(key, false);

      if (succeeded) {
        window.setTimeout(() => {
          void refresh(true);
        }, 120);
      }
    }
  };

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
  const completedEntries = state.entries.filter((entry) =>
    ["finished", "stopped", "dnf"].includes(entry.status),
  );
  const globalActionPending =
    pendingActions.has("start-event") ||
    pendingActions.has("stop-event");
  const entryIsPending = (entryId: number) =>
    pendingActions.has(`entry-${entryId}`) || globalActionPending;

  const handleStart = () => {
    const startedAt = new Date(
      Date.now() + clockOffset.current,
    ).toISOString();

    void runAction(
      "start-event",
      () => startRaceControlEvent(event.id),
      {
        exclusive: true,
        optimistic: () => {
          let previousState: RaceEventState | null = null;

          setState((current) => {
            previousState = current;
            if (current.event?.id !== event.id) return current;

            return {
              ...current,
              server_now: startedAt,
              event: {
                ...current.event,
                status: "running" as const,
                started_at: startedAt,
                completed_at: null,
              },
              entries: current.entries.map((entry) =>
                entry.status === "ready"
                  ? {
                      ...entry,
                      status: "running" as const,
                      last_crossing_at: startedAt,
                    }
                  : entry,
              ),
            };
          });

          return () => {
            if (previousState) setState(previousState);
          };
        },
      },
    );
  };

  const handleStop = () => {
    const elapsedMs = getCurrentElapsed();
    const completedAt = new Date(
      Date.now() + clockOffset.current,
    ).toISOString();

    void runAction(
      "stop-event",
      () => stopRaceControlEvent(event.id),
      {
        exclusive: true,
        optimistic: () => {
          let previousState: RaceEventState | null = null;

          setState((current) => {
            previousState = current;
            if (current.event?.id !== event.id) return current;

            return {
              ...current,
              event: {
                ...current.event,
                status: "finished" as const,
                completed_at: completedAt,
              },
              entries: current.entries.map((entry) =>
                entry.status === "running"
                  ? {
                      ...entry,
                      status: "dnf" as const,
                      pit_started_at: null,
                      finished_at: completedAt,
                      total_time_ms: elapsedMs,
                    }
                  : entry,
              ),
            };
          });

          return () => {
            if (previousState) setState(previousState);
          };
        },
      },
    );
  };

  const handleLap = (entryId: number) => {
    const elapsedMs = getCurrentElapsed();
    const crossingAt = event.started_at
      ? new Date(
          Date.parse(event.started_at) + elapsedMs,
        ).toISOString()
      : new Date().toISOString();

    void runAction(
      `entry-${entryId}`,
      () => recordRaceControlLap(entryId, elapsedMs),
      {
        optimistic: () =>
          updateEntryOptimistically(entryId, (entry) => {
            const previousCrossing = Date.parse(
              entry.last_crossing_at ?? event.started_at ?? crossingAt,
            );
            const currentCrossing = Date.parse(crossingAt);
            const lapTime =
              Number.isFinite(previousCrossing) &&
              Number.isFinite(currentCrossing)
                ? Math.max(0, currentCrossing - previousCrossing)
                : entry.last_lap_ms;
            const nextLapNumber = entry.lap_count + 1;

            return {
              ...entry,
              lap_count: nextLapNumber,
              last_crossing_at: crossingAt,
              last_lap_ms: lapTime,
              best_lap_ms:
                lapTime === null
                  ? entry.best_lap_ms
                  : entry.best_lap_ms === null
                    ? lapTime
                    : Math.min(entry.best_lap_ms, lapTime),
              laps:
                lapTime === null
                  ? entry.laps
                  : [
                      ...entry.laps,
                      {
                        id: -(Date.now() + entryId),
                        lap_number: nextLapNumber,
                        lap_time_ms: lapTime,
                        crossed_at: crossingAt,
                      },
                    ],
            };
          }),
      },
    );
  };

  const handlePitStop = (entryId: number) => {
    const changedAt = new Date(
      Date.now() + clockOffset.current,
    ).toISOString();

    void runAction(
      `entry-${entryId}`,
      () => toggleRaceControlPitStop(entryId),
      {
        optimistic: () =>
          updateEntryOptimistically(entryId, (entry) => {
            if (!entry.pit_started_at) {
              return {
                ...entry,
                pit_started_at: changedAt,
                pit_stop_count: entry.pit_stop_count + 1,
              };
            }

            const startedAt = Date.parse(entry.pit_started_at);
            const endedAt = Date.parse(changedAt);
            const duration =
              Number.isFinite(startedAt) && Number.isFinite(endedAt)
                ? Math.max(0, endedAt - startedAt)
                : 0;

            return {
              ...entry,
              pit_started_at: null,
              last_pit_duration_ms: duration,
              total_pit_duration_ms:
                entry.total_pit_duration_ms + duration,
            };
          }),
      },
    );
  };

  const handleEntryStop = (entryId: number) => {
    const elapsedMs = getCurrentElapsed();
    const stoppedAt = new Date(
      Date.now() + clockOffset.current,
    ).toISOString();

    void runAction(
      `entry-${entryId}`,
      () => stopRaceControlEntry(entryId, elapsedMs),
      {
        optimistic: () =>
          updateEntryOptimistically(entryId, (entry) => {
            let lastPitDuration = entry.last_pit_duration_ms;
            let totalPitDuration = entry.total_pit_duration_ms;

            if (entry.pit_started_at) {
              const pitStartedAt = Date.parse(entry.pit_started_at);
              const pitStoppedAt = Date.parse(stoppedAt);
              const duration =
                Number.isFinite(pitStartedAt) &&
                Number.isFinite(pitStoppedAt)
                  ? Math.max(0, pitStoppedAt - pitStartedAt)
                  : 0;
              lastPitDuration = duration;
              totalPitDuration += duration;
            }

            return {
              ...entry,
              status: "stopped" as const,
              pit_started_at: null,
              last_pit_duration_ms: lastPitDuration,
              total_pit_duration_ms: totalPitDuration,
              finished_at: stoppedAt,
              total_time_ms: elapsedMs,
            };
          }),
      },
    );
  };

  const handleFinish = (entryId: number) => {
    const elapsedMs = getCurrentElapsed();
    const finishedAt = new Date(
      Date.now() + clockOffset.current,
    ).toISOString();

    void runAction(
      `entry-${entryId}`,
      () => finishRaceControlEntry(entryId, elapsedMs),
      {
        optimistic: () =>
          updateEntryOptimistically(entryId, (entry) => ({
            ...entry,
            status: "finished" as const,
            pit_started_at: null,
            lap_count: event.target_laps,
            finished_at: finishedAt,
            total_time_ms: elapsedMs,
          })),
      },
    );
  };

  const handleDnf = (entryId: number) => {
    const elapsedMs = getCurrentElapsed();
    const finishedAt = new Date(
      Date.now() + clockOffset.current,
    ).toISOString();

    void runAction(
      `entry-${entryId}`,
      () => markRaceControlEntryDnf(entryId, elapsedMs),
      {
        optimistic: () =>
          updateEntryOptimistically(entryId, (entry) => ({
            ...entry,
            status: "dnf" as const,
            pit_started_at: null,
            finished_at: finishedAt,
            total_time_ms: elapsedMs,
          })),
      },
    );
  };

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
            disabled={event.status !== "running" || pendingActions.size > 0}
            type="button"
            onClick={handleStop}
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
              disabled={pendingActions.size > 0}
              type="button"
              onClick={handleStart}
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
              Le compteur change immédiatement. Utilise{" "}
              <strong>Arrêt stand</strong> à l’entrée puis{" "}
              <strong>Sortie stand</strong> au retour en piste. Le bouton{" "}
              <strong>Stop chrono</strong> arrête uniquement le pilote
              concerné.
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
            !entry.pit_started_at &&
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
                  : entry.status === "stopped"
                    ? styles.driverStopped
                    : entry.status === "dnf"
                      ? styles.driverDnf
                      : entry.pit_started_at
                        ? styles.driverPit
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
                  {entry.pit_started_at ? "Aux stands" : statusLabel(entry.status)}
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

              {(entry.pit_stop_count > 0 || entry.pit_started_at) && (
                <div className={styles.pitStatus}>
                  <div>
                    <span>ARRÊTS STAND</span>
                    <strong>{entry.pit_stop_count}</strong>
                  </div>
                  <div>
                    <span>
                      {entry.pit_started_at
                        ? "ARRÊT EN COURS"
                        : "DERNIER ARRÊT"}
                    </span>
                    <strong>
                      <LivePitClock
                        startedAt={entry.pit_started_at}
                        fixedMs={entry.last_pit_duration_ms ?? 0}
                        running={Boolean(entry.pit_started_at)}
                        clockOffset={clockOffset}
                      />
                    </strong>
                  </div>
                  <div>
                    <span>TEMPS TOTAL STANDS</span>
                    <strong>
                      {formatRaceTime(entry.total_pit_duration_ms)}
                    </strong>
                  </div>
                </div>
              )}

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
                      disabled={!canRecordLap || entryIsPending(entry.id)}
                      type="button"
                      onClick={() => handleLap(entry.id)}
                    >
                      +1 tour
                    </button>

                    <button
                      className={styles.pitButton}
                      disabled={entryIsPending(entry.id)}
                      type="button"
                      onClick={() => handlePitStop(entry.id)}
                    >
                      {entry.pit_started_at
                        ? "▶ Sortie stand"
                        : "⏸ Arrêt stand"}
                    </button>

                    <button
                      className={styles.stopEntryButton}
                      disabled={entryIsPending(entry.id)}
                      type="button"
                      onClick={() => handleEntryStop(entry.id)}
                    >
                      ■ Stop chrono
                    </button>

                    <button
                      className={styles.finishButton}
                      disabled={
                        !canFinish ||
                        Boolean(entry.pit_started_at) ||
                        entryIsPending(entry.id)
                      }
                      type="button"
                      onClick={() => handleFinish(entry.id)}
                    >
                      🏁 Arrivée
                    </button>

                    <button
                      className={styles.dnfButton}
                      disabled={entryIsPending(entry.id)}
                      type="button"
                      onClick={() => handleDnf(entry.id)}
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

              {entry.status === "stopped" && (
                <footer className={styles.finalEntryResult}>
                  <span>Chrono individuel</span>
                  <strong>ARRÊTÉ</strong>
                  <small>
                    {formatRaceTime(entry.total_time_ms, true)} ·{" "}
                    {entry.lap_count} tour(s)
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
            <input
              type="hidden"
              name="return_base_path"
              value={basePath}
            />
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
              <input
                type="hidden"
                name="return_base_path"
                value={basePath}
              />
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
