import type { TreasureHunt } from "@/lib/treasure-hunt/data";

import styles from "./treasure-hunt.module.css";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function TreasureHuntPublic({ hunts }: { hunts: TreasureHunt[] }) {
  return (
    <div className={styles.publicPage}>
      <header className="document-hero">
        <p className="eyebrow">NOSTRA GROUP · ÉVÉNEMENTS</p>
        <h1 className="page-title">Chasses au trésor</h1>
        <p className="lead">
          Suivez les indices révélés par la Direction et soyez le premier à
          retrouver le trésor.
        </p>
      </header>

      {hunts.length === 0 && (
        <div className={styles.empty}>
          Aucune chasse au trésor n’est ouverte pour le moment.
        </div>
      )}

      {hunts.map((hunt) => {
        const hiddenCount = Math.max(
          0,
          hunt.clue_count - hunt.revealed_clue_count,
        );
        const startsAt = formatDate(hunt.starts_at);
        const endsAt = formatDate(hunt.ends_at);

        return (
          <article className={styles.publicCard} key={hunt.id}>
            <div className={styles.publicHeader}>
              <div>
                <span className={styles.status}>
                  {hunt.status === "completed" ? "Terminée" : "En cours"}
                </span>
                <h2>{hunt.title}</h2>
              </div>
              <div className={styles.huntMeta}>
                <span>{hunt.revealed_clue_count} indice(s) révélé(s)</span>
              </div>
            </div>

            <p className={styles.clueCopy}>{hunt.description}</p>

            <div className={styles.huntMeta}>
              {hunt.prize && <span>🏆 Lot : {hunt.prize}</span>}
              {hunt.meeting_point && (
                <span>📍 Départ : {hunt.meeting_point}</span>
              )}
              {startsAt && <span>🕒 Début : {startsAt}</span>}
              {endsAt && <span>⏳ Fin : {endsAt}</span>}
            </div>

            {hunt.winner_name && (
              <div className={styles.winner}>
                <strong>🏆 Gagnant : {hunt.winner_name}</strong>
                {hunt.winner_note && <p>{hunt.winner_note}</p>}
              </div>
            )}

            <section className={styles.clueSection}>
              <div>
                <p className="eyebrow">PARCOURS</p>
                <h3>Indices révélés</h3>
              </div>

              <div className={styles.publicClues}>
                {hunt.clues.length === 0 && (
                  <div className={styles.hiddenCount}>
                    Le premier indice n’a pas encore été révélé.
                  </div>
                )}

                {hunt.clues.map((clue, index) => (
                  <article className={styles.clueCard} key={clue.id}>
                    <div className={styles.clueHeader}>
                      <div className={styles.inlineActions}>
                        <span className={styles.clueNumber}>{index + 1}</span>
                        <h3>{clue.title}</h3>
                      </div>
                      {clue.zone && <span className={styles.status}>{clue.zone}</span>}
                    </div>
                    <p className={styles.clueCopy}>{clue.content}</p>
                    {clue.image_url && (
                      // Une balise img garde la compatibilité avec toute URL d’indice.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.clueImage}
                        src={clue.image_url}
                        alt={`Illustration de l’indice ${index + 1}`}
                      />
                    )}
                  </article>
                ))}

                {hiddenCount > 0 && hunt.status !== "completed" && (
                  <div className={styles.hiddenCount}>
                    🔒 {hiddenCount} indice(s) restent encore à découvrir.
                  </div>
                )}
              </div>
            </section>
          </article>
        );
      })}
    </div>
  );
}
