
import type {
  CircuitLapRecord,
  EventStanding,
  TimeTrialRecord,
} from "@/lib/special-rankings/types";
import styles from "./special-rankings.module.css";

function pad(value: number, length = 2): string {
  return Math.max(0, value).toString().padStart(length, "0");
}

export function formatRankingTime(milliseconds: number): string {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(
      millis,
      3,
    )}`;
  }

  return `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00`));
}

export function EventStandings({
  standings,
}: {
  standings: EventStanding[];
}) {
  if (standings.length === 0) {
    return <EmptyRanking label="événement" />;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Pilote</th>
              <th>Écurie(s)</th>
              <th>Points</th>
              <th>Événements</th>
              <th>Victoires</th>
              <th>Podiums</th>
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
                <td>{standing.events}</td>
                <td>{standing.wins}</td>
                <td>{standing.podiums}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TimeTrialRankings({
  records,
}: {
  records: TimeTrialRecord[];
}) {
  if (records.length === 0) {
    return <EmptyRanking label="contre-la-montre" />;
  }

  const groups = groupBy(records, (record) => record.course_name);

  return (
    <section className={styles.groups}>
      {[...groups.entries()].map(([course, courseRecords]) => (
        <article className={styles.panel} key={course}>
          <header className={styles.groupHeader}>
            <span>⏱️ CHRONO CONTRE LA MONTRE</span>
            <h2>{course}</h2>
          </header>

          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Pilote</th>
                  <th>Écurie</th>
                  <th>Véhicule</th>
                  <th>Temps</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {courseRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.rank}</strong>
                    </td>
                    <td>{record.driver_name}</td>
                    <td>{record.team_name}</td>
                    <td>{record.vehicle_name}</td>
                    <td>
                      <strong>
                        {formatRankingTime(record.time_ms)}
                      </strong>
                    </td>
                    <td>{formatDate(record.attempt_date)}</td>
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

export function CircuitLapRecords({
  records,
}: {
  records: CircuitLapRecord[];
}) {
  if (records.length === 0) {
    return <EmptyRanking label="record du tour" />;
  }

  const groups = groupBy(
    records,
    (record) => record.circuit_layout,
  );

  return (
    <section className={styles.groups}>
      {[...groups.entries()].map(([layout, layoutRecords]) => {
        const record = layoutRecords[0];

        return (
          <article className={styles.panel} key={layout}>
            <header className={styles.recordHeader}>
              <div>
                <span>🏁 RECORD OFFICIEL DU CIRCUIT</span>
                <h2>{layout}</h2>
                <p>
                  {record.driver_name} · {record.team_name} ·{" "}
                  {record.vehicle_name}
                </p>
              </div>
              <strong>
                {formatRankingTime(record.lap_time_ms)}
              </strong>
            </header>

            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Pilote</th>
                    <th>Écurie</th>
                    <th>Véhicule</th>
                    <th>Tour</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {layoutRecords.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <strong>{entry.rank}</strong>
                      </td>
                      <td>{entry.driver_name}</td>
                      <td>{entry.team_name}</td>
                      <td>{entry.vehicle_name}</td>
                      <td>
                        <strong>
                          {formatRankingTime(entry.lap_time_ms)}
                        </strong>
                      </td>
                      <td>{formatDate(entry.record_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function EmptyRanking({ label }: { label: string }) {
  return (
    <section className={styles.empty}>
      <span>🏆</span>
      <h2>Classement en attente</h2>
      <p>
        Le premier résultat {label} apparaîtra ici après validation
        d’un commissaire.
      </p>
    </section>
  );
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }

  return groups;
}
