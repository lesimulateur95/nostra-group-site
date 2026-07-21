import styles from "./fortune.module.css";

export function FortunePuzzleBoard({
  category,
  puzzle,
  label,
}: {
  category: string;
  puzzle: string;
  label: string;
}) {
  return (
    <section className={styles.puzzlePanel}>
      <div className={styles.puzzleHeader}>
        <span>{label}</span>
        <strong>{category || "Catégorie à venir"}</strong>
      </div>
      <div className={styles.puzzleBoard}>
        {puzzle.split(" ").map((word, wordIndex) => (
          <div className={styles.puzzleWord} key={`${word}-${wordIndex}`}>
            {[...word].map((character, characterIndex) => {
              const hidden = character === "□";
              return (
                <span
                  key={`${wordIndex}-${characterIndex}`}
                  className={`${styles.puzzleTile} ${hidden ? styles.puzzleHidden : styles.puzzleRevealed}`}
                >
                  {hidden ? "" : character}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
