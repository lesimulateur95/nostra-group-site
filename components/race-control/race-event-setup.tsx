
"use client";

import { useMemo, useState } from "react";
import { createRaceControlEvent } from "@/app/actions/race-control";
import styles from "./race-control.module.css";

type EntryDraft = {
  id: number;
  driver_name: string;
  team_name: string;
};

function newEntry(id: number): EntryDraft {
  return {
    id,
    driver_name: "",
    team_name: "",
  };
}

export function RaceEventSetup() {
  const [nextId, setNextId] = useState(5);
  const [entries, setEntries] = useState<EntryDraft[]>([
    newEntry(1),
    newEntry(2),
    newEntry(3),
    newEntry(4),
  ]);

  const validEntries = useMemo(
    () =>
      entries
        .map((entry) => ({
          driver_name: entry.driver_name.trim(),
          team_name: entry.team_name.trim(),
        }))
        .filter(
          (entry) => entry.driver_name && entry.team_name,
        ),
    [entries],
  );

  const updateEntry = (
    id: number,
    key: "driver_name" | "team_name",
    value: string,
  ) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, [key]: value } : entry,
      ),
    );
  };

  const addEntry = () => {
    setEntries((current) => [...current, newEntry(nextId)]);
    setNextId((value) => value + 1);
  };

  const removeEntry = (id: number) => {
    setEntries((current) =>
      current.length <= 1
        ? current
        : current.filter((entry) => entry.id !== id),
    );
  };

  return (
    <form action={createRaceControlEvent} className={styles.setupForm}>
      <input
        type="hidden"
        name="entries_json"
        value={JSON.stringify(validEntries)}
      />

      <div className={styles.setupGrid}>
        <label>
          <span>Nom de la course</span>
          <input
            name="title"
            maxLength={160}
            required
            placeholder="Exemple : Grand Prix de Locmaria"
          />
        </label>

        <label>
          <span>Type de course</span>
          <select name="competition_type" defaultValue="f1">
            <option value="f1">Championnat F1</option>
            <option value="gt3rs">Championnat GT3 RS</option>
            <option value="general">
              Course libre / événement spécial
            </option>
          </select>
        </label>

        <label>
          <span>Nombre de tours</span>
          <input
            type="number"
            name="target_laps"
            min={1}
            max={999}
            required
            defaultValue={10}
          />
        </label>
      </div>

      <section className={styles.entriesEditor}>
        <header>
          <div>
            <span className={styles.sectionLabel}>
              GRILLE DE DÉPART
            </span>
            <h2>Pilotes et écuries</h2>
            <p>
              Ajoute une ligne par pilote. Une même écurie peut avoir
              plusieurs pilotes.
            </p>
          </div>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={addEntry}
          >
            + Ajouter un pilote
          </button>
        </header>

        <div className={styles.entryRows}>
          {entries.map((entry, index) => (
            <div className={styles.entryRow} key={entry.id}>
              <strong>{index + 1}</strong>

              <label>
                <span>Pilote</span>
                <input
                  value={entry.driver_name}
                  maxLength={120}
                  required={index === 0}
                  placeholder="Nom du pilote"
                  onChange={(event) =>
                    updateEntry(
                      entry.id,
                      "driver_name",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Écurie</span>
                <input
                  value={entry.team_name}
                  maxLength={120}
                  required={index === 0}
                  placeholder="Nom de l’écurie"
                  onChange={(event) =>
                    updateEntry(
                      entry.id,
                      "team_name",
                      event.target.value,
                    )
                  }
                />
              </label>

              <button
                aria-label={`Supprimer la ligne ${index + 1}`}
                className={styles.removeButton}
                type="button"
                onClick={() => removeEntry(entry.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <footer className={styles.setupFooter}>
          <span>
            {validEntries.length} pilote
            {validEntries.length > 1 ? "s" : ""} prêt
            {validEntries.length > 1 ? "s" : ""}
          </span>

          <button
            className={styles.primaryButton}
            disabled={validEntries.length < 1}
            type="submit"
          >
            Valider la grille et ouvrir les chronomètres →
          </button>
        </footer>
      </section>
    </form>
  );
}
