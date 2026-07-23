"use client";

import { useState } from "react";

import { createCircuitDisciplinaryAction } from "@/app/actions/circuit-discipline";
import type { CircuitDisciplineLicence, DisciplineActionType } from "@/lib/discipline/data";

import styles from "./discipline-form.module.css";

export function DisciplineForm({
  licences,
}: {
  licences: CircuitDisciplineLicence[];
}) {
  const [actionType, setActionType] = useState<DisciplineActionType>("warning");

  return (
    <form action={createCircuitDisciplinaryAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          <span>Licence concernée</span>
          <select name="licence_id" required defaultValue="">
            <option value="" disabled>
              Choisir une licence
            </option>
            {licences.map((licence) => (
              <option value={licence.id} key={licence.id}>
                {licence.holderName} · {licence.licenceNumber} · {licence.licenceName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Mesure disciplinaire</span>
          <select
            name="action_type"
            value={actionType}
            onChange={(event) =>
              setActionType(event.target.value as DisciplineActionType)
            }
          >
            <option value="warning">Avertissement</option>
            <option value="penalty">Pénalité</option>
            <option value="suspension">Suspension temporaire</option>
            <option value="points_deduction">Retrait de points</option>
          </select>
        </label>

        <label>
          <span>Niveau de gravité</span>
          <select name="severity" defaultValue="minor">
            <option value="minor">Mineur</option>
            <option value="major">Majeur</option>
            <option value="critical">Critique</option>
          </select>
        </label>

        <label>
          <span>Course ou événement concerné</span>
          <input
            name="event_name"
            maxLength={160}
            placeholder="Exemple : Grand Prix Nostra — Manche 4"
          />
        </label>
      </div>

      {actionType === "penalty" ? (
        <label className={styles.singleField}>
          <span>Montant de la pénalité en euros RP</span>
          <input
            type="number"
            name="penalty_amount"
            min="0"
            step="1000"
            defaultValue="0"
          />
          <small>Laisse 0 pour une pénalité sportive sans montant financier.</small>
        </label>
      ) : null}

      {actionType === "points_deduction" ? (
        <label className={styles.singleField}>
          <span>Nombre de points retirés</span>
          <input
            type="number"
            name="points_removed"
            min="1"
            max="12"
            defaultValue="1"
            required
          />
          <small>Chaque licence possède un capital disciplinaire de 12 points.</small>
        </label>
      ) : null}

      {actionType === "suspension" ? (
        <div className={styles.grid}>
          <label>
            <span>Début de la suspension</span>
            <input type="date" name="suspension_starts_on" required />
          </label>
          <label>
            <span>Fin de la suspension incluse</span>
            <input type="date" name="suspension_ends_on" required />
          </label>
        </div>
      ) : null}

      <label className={styles.singleField}>
        <span>Motif officiel</span>
        <textarea
          name="reason"
          rows={4}
          minLength={3}
          maxLength={2000}
          required
          placeholder="Décris précisément le comportement, l’infraction ou la décision prise."
        />
      </label>

      <label className={styles.singleField}>
        <span>Observations complémentaires</span>
        <textarea
          name="note"
          rows={3}
          maxLength={3000}
          placeholder="Décision des commissaires, éléments de preuve, conditions de retour…"
        />
      </label>

      <div className={styles.footer}>
        <p>
          Le pilote recevra automatiquement une notification et la mesure sera
          ajoutée à l’historique permanent de la Direction.
        </p>
        <button type="submit" className="btn btn-primary">
          Enregistrer la mesure
        </button>
      </div>
    </form>
  );
}
