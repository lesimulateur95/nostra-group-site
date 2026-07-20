
import type {
  DriverStanding,
  PublicRaceResultEvent,
  TeamStanding,
} from "@/lib/race-control/types";
import styles from "./race-control.module.css";

function pad(value: number, size = 2): string {
  return Math.max(0, value).toString().padStart(size, "0");
}

function formatTime(value: number | null, hours = false): string {
  if (value === null) return "—";

  const safe = Math.max(0, Math.round(value));
  const h = Math.floor(safe / 3_600_000);
  const m = Math.floor((safe % 3_600_000) / 60_000);
  const s = Math.floor((safe % 60_000) / 1_000);
  const ms = safe % 1_000;

  if (hours || h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  }

  return `${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Date non renseignée";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function PublicRaceResults({
  events,
}: {
  events: PublicRaceResultEvent[];
}) {
  if (events.length === 0) {
    return (
      <section className={styles.publicEmpty}>
        <span>🏁</span>
        <h2>Aucun résultat publié</h2>
        <p>
          Les résultats apparaîtront ici après validation par la
          direction de course.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.publicResults}>
      {events.map((event) => (
        <article className={styles.publicRace} key={event.id}>
          <header>
            <div>
              <span className={styles.sectionLabel}>
                RÉSULTAT HOMOLOGUÉ
              </span>
              <h2>{event.title}</h2>
              <p>
                {formatDate(event.completed_at)} ·{" "}
                {event.target_laps} tour
                {event.target_laps > 1 ? "s" : ""}
              </p>
            </div>

            {event.best_lap && (
              <div className={styles.publicBestLap}>
                <span>⚡ MEILLEUR TOUR</span>
                <strong>
                  {formatTime(event.best_lap.lap_time_ms)}
                </strong>
                <small>
                  {event.best_lap.driver_name} ·{" "}
                  {event.best_lap.team_name}
                </small>
              </div>
            )}
          </header>

          <div className={styles.tableScroller}>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Pilote</th>
                  <th>Écurie</th>
                  <th>Tours</th>
                  <th>Temps total</th>
                  <th>Meilleur tour</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {event.entries.map((entry) => (
                  <tr key={`${event.id}-${entry.driver_name}`}>
                    <td>
                      <strong>{entry.position ?? "—"}</strong>
                    </td>
                    <td>{entry.driver_name}</td>
                    <td>{entry.team_name}</td>
                    <td>{entry.lap_count}</td>
                    <td>
                      {entry.status === "dnf"
                        ? "ABANDON"
                        : formatTime(entry.total_time_ms, true)}
                    </td>
                    <td>{formatTime(entry.best_lap_ms)}</td>
                    <td>
                      <strong>{entry.championship_points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}

export function DriverStandingsTable({
  standings,
}: {
  standings: DriverStanding[];
}) {
  return (
    <StandingsShell empty={standings.length === 0}>
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Pilote</th>
            <th>Écurie(s)</th>
            <th>Points</th>
            <th>Courses</th>
            <th>Victoires</th>
            <th>Podiums</th>
            <th>Meilleurs tours</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr key={standing.driver_name}>
              <td>
                <strong>{standing.position}</strong>
              </td>
              <td>{standing.driver_name}</td>
              <td>{standing.teams}</td>
              <td>
                <strong>{standing.points}</strong>
              </td>
              <td>{standing.races}</td>
              <td>{standing.wins}</td>
              <td>{standing.podiums}</td>
              <td>{standing.best_laps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StandingsShell>
  );
}

export function TeamStandingsTable({
  standings,
}: {
  standings: TeamStanding[];
}) {
  return (
    <StandingsShell empty={standings.length === 0}>
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Écurie</th>
            <th>Points</th>
            <th>Courses</th>
            <th>Victoires</th>
            <th>Podiums</th>
            <th>Meilleurs tours</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr key={standing.team_name}>
              <td>
                <strong>{standing.position}</strong>
              </td>
              <td>{standing.team_name}</td>
              <td>
                <strong>{standing.points}</strong>
              </td>
              <td>{standing.races}</td>
              <td>{standing.wins}</td>
              <td>{standing.podiums}</td>
              <td>{standing.best_laps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StandingsShell>
  );
}

function StandingsShell({
  empty,
  children,
}: {
  empty: boolean;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <section className={styles.publicEmpty}>
        <span>🏆</span>
        <h2>Classement en attente</h2>
        <p>
          Le classement sera calculé dès qu’une première course sera
          publiée.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.standingsPanel}>
      <div className={styles.tableScroller}>{children}</div>
    </section>
  );
}
