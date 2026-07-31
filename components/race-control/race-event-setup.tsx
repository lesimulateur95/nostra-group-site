"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRaceControlEvent } from "@/app/actions/race-control";
import styles from "./race-control.module.css";

function initialRowIds(): number[] {
  return [1, 2, 3, 4];
}

type InspectedRows = {
  readyCount: number;
  incompleteRows: number[];
};

function inspectRows(form: HTMLFormElement): InspectedRows {
  const drivers = Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[name="driver_name"]',
    ),
  );
  const teams = Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[name="team_name"]',
    ),
  );

  const incompleteRows: number[] = [];
  let readyCount = 0;
  const rowCount = Math.min(drivers.length, teams.length);

  for (let index = 0; index < rowCount; index += 1) {
    const hasDriver = drivers[index].value.trim().length > 0;
    const hasTeam = teams[index].value.trim().length > 0;

    if (hasDriver && hasTeam) readyCount += 1;
    if (hasDriver !== hasTeam) incompleteRows.push(index + 1);
  }

  return { readyCount, incompleteRows };
}

export function RaceEventSetup() {
  const formRef = useRef<HTMLFormElement>(null);
  const readyCountRef = useRef<HTMLSpanElement>(null);
  const updateFrameRef = useRef<number | null>(null);
  const [nextId, setNextId] = useState(5);
  const [rowIds, setRowIds] = useState<number[]>(initialRowIds);
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshReadyCount = () => {
    const form = formRef.current;
    const target = readyCountRef.current;
    if (!form || !target) return;

    const { readyCount } = inspectRows(form);
    target.textContent = `${readyCount} pilote${
      readyCount > 1 ? "s" : ""
    } prêt${readyCount > 1 ? "s" : ""}`;
  };

  const scheduleReadyCountRefresh = () => {
    if (updateFrameRef.current !== null) {
      window.cancelAnimationFrame(updateFrameRef.current);
    }

    updateFrameRef.current = window.requestAnimationFrame(() => {
      updateFrameRef.current = null;
      refreshReadyCount();
    });
  };

  useEffect(() => {
    scheduleReadyCountRefresh();

    return () => {
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current);
      }
    };
  }, [rowIds.length]);

  const addEntry = () => {
    setClientError(null);
    setRowIds((current) => {
      if (current.length >= 40) return current;
      return [...current, nextId];
    });
    setNextId((value) => value + 1);
  };

  const removeEntry = (id: number) => {
    setClientError(null);
    setRowIds((current) =>
      current.length <= 1
        ? current
        : current.filter((entryId) => entryId !== id),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const { readyCount, incompleteRows } = inspectRows(
      event.currentTarget,
    );

    if (incompleteRows.length > 0) {
      event.preventDefault();
      setSubmitting(false);
      setClientError(
        `Complète le pilote et l’écurie, ou vide entièrement la ligne ${incompleteRows.join(
          ", ",
        )}.`,
      );
      return;
    }

    if (readyCount < 1) {
      event.preventDefault();
      setSubmitting(false);
      setClientError(
        "Ajoute au moins un pilote avec le nom de son écurie.",
      );
      return;
    }

    setClientError(null);
    setSubmitting(true);
  };

  return (
    <form
      ref={formRef}
      action={createRaceControlEvent}
      className={styles.setupForm}
      onSubmit={handleSubmit}
    >
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
            disabled={rowIds.length >= 40 || submitting}
            type="button"
            onClick={addEntry}
          >
            + Ajouter un pilote
          </button>
        </header>

        <div className={styles.entryRows}>
          {rowIds.map((rowId, index) => {
            const driverId = `race-driver-${rowId}`;
            const teamId = `race-team-${rowId}`;

            return (
              <div className={styles.entryRow} key={rowId}>
                <strong>{index + 1}</strong>

                <label htmlFor={driverId}>
                  <span>Pilote</span>
                  <input
                    id={driverId}
                    name="driver_name"
                    maxLength={120}
                    placeholder="Nom du pilote"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={submitting}
                    onInput={scheduleReadyCountRefresh}
                  />
                </label>

                <label htmlFor={teamId}>
                  <span>Écurie</span>
                  <input
                    id={teamId}
                    name="team_name"
                    maxLength={120}
                    placeholder="Nom de l’écurie"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={submitting}
                    onInput={scheduleReadyCountRefresh}
                  />
                </label>

                <button
                  aria-label={`Supprimer la ligne ${index + 1}`}
                  className={styles.removeButton}
                  disabled={submitting}
                  type="button"
                  onClick={() => removeEntry(rowId)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {clientError && (
          <p className={styles.error} role="alert">
            {clientError}
          </p>
        )}

        <footer className={styles.setupFooter}>
          <span ref={readyCountRef}>0 pilote prêt</span>

          <button
            className={styles.primaryButton}
            disabled={submitting}
            type="submit"
          >
            {submitting
              ? "Ouverture des chronomètres…"
              : "Valider la grille et ouvrir les chronomètres →"}
          </button>
        </footer>
      </section>
    </form>
  );
}
