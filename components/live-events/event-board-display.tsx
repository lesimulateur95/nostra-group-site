import type { CSSProperties } from "react";
import type { EventCitizen, LiveEventBoard } from "@/lib/live-events/types";
import styles from "./live-events.module.css";

function sameCitizen(a: EventCitizen | null | undefined, b: EventCitizen | null | undefined) {
  return Boolean(a && b && a.user_id === b.user_id && a.name === b.name);
}

function bracketRounds(event: LiveEventBoard) {
  const { size, participants, winners } = event.bracket_data;
  const roundCount = Math.log2(size);
  const rounds: Array<Array<[EventCitizen | null, EventCitizen | null]>> = [];
  let entries = participants.slice(0, size);
  for (let round = 0; round < roundCount; round += 1) {
    const matches: Array<[EventCitizen | null, EventCitizen | null]> = [];
    for (let match = 0; match < entries.length / 2; match += 1) {
      matches.push([entries[match * 2] ?? null, entries[match * 2 + 1] ?? null]);
    }
    rounds.push(matches);
    entries = matches.map((_, match) => winners[`r${round}m${match}`] ?? null);
  }
  return { rounds, champion: entries[0] ?? null };
}

export function EventBoardDisplay({
  event,
  onWinner,
}: {
  event: LiveEventBoard;
  onWinner?: (round: number, match: number, citizen: EventCitizen) => void;
}) {
  const date = event.starts_at ? new Date(event.starts_at) : null;
  const style = {
    "--event-accent": event.accent_color,
  } as CSSProperties;
  const bracket = event.format === "bracket" ? bracketRounds(event) : null;

  return (
    <article className={styles.publicEvent} style={style}>
      <header className={styles.publicHeader}>
        <div>
          <span className="eyebrow">ÉVÉNEMENT NOSTRA GROUP</span>
          <h2>{event.title}</h2>
          {event.subtitle && <p>{event.subtitle}</p>}
          <div className={styles.eventMeta} style={{ marginTop: 12 }}>
            {date && <span>{date.toLocaleString("fr-FR")}</span>}
            {event.location && <span>• {event.location}</span>}
          </div>
        </div>
        <span className={styles.livePill}>
          {event.status === "live" && <span className={styles.liveDot} />}
          {event.status === "live" ? "EN DIRECT" : "TERMINÉ"}
        </span>
      </header>

      <div className={styles.publicBody}>
        {event.format === "bracket" && bracket && (
          <div
            className={styles.bracket}
            style={{ "--rounds": bracket.rounds.length + 1 } as CSSProperties}
          >
            {bracket.rounds.map((matches, roundIndex) => (
              <section className={styles.round} key={roundIndex}>
                <span className={styles.roundTitle}>
                  {roundIndex === bracket.rounds.length - 1
                    ? "Finale"
                    : roundIndex === bracket.rounds.length - 2
                      ? "Demi-finales"
                      : `Tour ${roundIndex + 1}`}
                </span>
                {matches.map((match, matchIndex) => {
                  const selected = event.bracket_data.winners[`r${roundIndex}m${matchIndex}`];
                  return (
                    <div className={styles.match} key={matchIndex}>
                      {match.map((citizen, competitorIndex) => {
                        const content = citizen ? citizen.name : "À déterminer";
                        const className = `${styles.competitor} ${
                          sameCitizen(selected, citizen) ? styles.winner : ""
                        } ${!citizen ? styles.emptySlot : ""}`;
                        return onWinner && citizen ? (
                          <button
                            className={`${styles.winnerButton} ${className}`}
                            key={competitorIndex}
                            type="button"
                            onClick={() => onWinner(roundIndex, matchIndex, citizen)}
                            title="Qualifier ce participant"
                          >
                            <span>{content}</span>
                            {sameCitizen(selected, citizen) && <span>✓</span>}
                          </button>
                        ) : (
                          <div className={className} key={competitorIndex}>
                            <span>{content}</span>
                            {sameCitizen(selected, citizen) && <span>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            ))}
            <section className={styles.round}>
              <span className={styles.roundTitle}>Champion</span>
              <div className={styles.champion}>
                <span>🏆</span>
                <strong>{bracket.champion?.name ?? "À déterminer"}</strong>
              </div>
            </section>
          </div>
        )}

        {event.format === "table" && (
          <div className={styles.publicTableWrap}>
            <table className={styles.publicTable}>
              <thead>
                <tr>
                  {event.table_data.columns.map((column) => (
                    <th key={column.id}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {event.table_data.rows.map((row) => (
                  <tr key={row.id}>
                    {event.table_data.columns.map((column) => {
                      const cell = row.cells[column.id];
                      return (
                        <td key={column.id}>
                          {cell && typeof cell === "object" ? cell.name : String(cell ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {event.table_data.rows.length === 0 && (
                  <tr><td colSpan={Math.max(event.table_data.columns.length, 1)}>Aucune ligne pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
