"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";

import { createCircuitDisciplinaryAction } from "@/app/actions/circuit-discipline";
import type {
  CircuitDisciplineLicence,
  DisciplineActionType,
} from "@/lib/discipline/data";

import styles from "./discipline-form.module.css";

type CitizenOption = {
  id: string;
  name: string;
  licenceCount: number;
};

type DisciplineSeverity = "minor" | "major" | "critical";

type PointScaleEntry = {
  id: string;
  label: string;
  description: string;
  points: number;
  severity: DisciplineSeverity;
};

const ACTION_OPTIONS: Array<{
  value: DisciplineActionType;
  label: string;
  description: string;
}> = [
  {
    value: "warning",
    label: "Avertissement",
    description: "Ajoute un avertissement au dossier du pilote.",
  },
  {
    value: "penalty",
    label: "Pénalité",
    description: "Enregistre une pénalité sportive ou financière RP.",
  },
  {
    value: "suspension",
    label: "Suspension temporaire",
    description: "Suspend la licence entre deux dates précises.",
  },
  {
    value: "points_deduction",
    label: "Retrait de points",
    description: "Retire directement des points sur les 12 points de la licence.",
  },
];

const POINT_SCALE: PointScaleEntry[] = [
  {
    id: "track-limits",
    label: "Limites de piste ou consigne mineure",
    description: "Infractions répétées aux limites de piste ou consigne simple non respectée.",
    points: 1,
    severity: "minor",
  },
  {
    id: "unsafe-move",
    label: "Manœuvre ou dépassement dangereux",
    description: "Manœuvre évitable ayant mis un autre pilote en difficulté sans accident grave.",
    points: 2,
    severity: "minor",
  },
  {
    id: "avoidable-contact",
    label: "Contact responsable",
    description: "Contact évitable causant une perte de position ou des dégâts légers.",
    points: 3,
    severity: "major",
  },
  {
    id: "yellow-flag",
    label: "Non-respect d’un drapeau jaune",
    description: "Vitesse ou dépassement non conforme sous drapeau jaune ou ordre commissaire ignoré.",
    points: 4,
    severity: "major",
  },
  {
    id: "responsible-crash",
    label: "Accident responsable important",
    description: "Accident causé avec dégâts importants ou abandon d’un autre concurrent.",
    points: 5,
    severity: "major",
  },
  {
    id: "safety-car-red-flag",
    label: "Non-respect Safety Car ou drapeau rouge",
    description: "Consigne majeure de sécurité ignorée pendant une neutralisation ou un arrêt de course.",
    points: 6,
    severity: "critical",
  },
  {
    id: "serious-unsporting",
    label: "Comportement antisportif grave",
    description: "Obstruction volontaire, récidive grave ou comportement mettant la course en danger.",
    points: 8,
    severity: "critical",
  },
  {
    id: "intentional-collision",
    label: "Collision volontaire",
    description: "Action volontaire contre un pilote ou mise en danger majeure des participants.",
    points: 10,
    severity: "critical",
  },
  {
    id: "fraud-cheating",
    label: "Triche, falsification ou récidive extrême",
    description: "Triche avérée, falsification de documents ou faute critique justifiant la perte totale.",
    points: 12,
    severity: "critical",
  },
];

const SEVERITY_LABELS: Record<DisciplineSeverity, string> = {
  minor: "Mineur",
  major: "Majeur",
  critical: "Critique",
};

function citizenKey(licence: CircuitDisciplineLicence): string {
  return licence.holderUserId || `licence:${licence.id}`;
}

export function DisciplineForm({
  licences,
  initialLicenceId,
}: {
  licences: CircuitDisciplineLicence[];
  initialLicenceId?: string;
}) {
  const initialLicence = licences.find(
    (licence) => licence.id === initialLicenceId,
  );

  const [actionType, setActionType] = useState<DisciplineActionType>(
    initialLicence ? "points_deduction" : "warning",
  );
  const [selectedCitizenId, setSelectedCitizenId] = useState(
    initialLicence ? citizenKey(initialLicence) : "",
  );
  const [selectedLicenceId, setSelectedLicenceId] = useState(
    initialLicence?.id ?? "",
  );
  const [pointsToRemove, setPointsToRemove] = useState(1);
  const [severity, setSeverity] = useState<DisciplineSeverity>("minor");
  const [reason, setReason] = useState("");
  const [selectedScaleId, setSelectedScaleId] = useState("");

  const citizens = useMemo<CitizenOption[]>(() => {
    const byCitizen = new Map<string, CitizenOption>();

    for (const licence of licences) {
      const id = citizenKey(licence);
      const existing = byCitizen.get(id);

      if (existing) {
        existing.licenceCount += 1;
        continue;
      }

      byCitizen.set(id, {
        id,
        name: licence.holderName,
        licenceCount: 1,
      });
    }

    return Array.from(byCitizen.values()).sort((first, second) =>
      first.name.localeCompare(second.name, "fr", { sensitivity: "base" }),
    );
  }, [licences]);

  const citizenLicences = useMemo(
    () =>
      licences.filter(
        (licence) => citizenKey(licence) === selectedCitizenId,
      ),
    [licences, selectedCitizenId],
  );

  const selectedLicence = useMemo(
    () => licences.find((licence) => licence.id === selectedLicenceId) ?? null,
    [licences, selectedLicenceId],
  );

  const maxRemovablePoints = selectedLicence?.pointsRemaining ?? 0;

  useEffect(() => {
    if (!selectedLicence) return;

    if (maxRemovablePoints <= 0) {
      setPointsToRemove(0);
      return;
    }

    setPointsToRemove((current) =>
      Math.min(Math.max(current || 1, 1), maxRemovablePoints),
    );
  }, [selectedLicence, maxRemovablePoints]);

  function handleCitizenChange(value: string) {
    setSelectedCitizenId(value);

    const matchingLicences = licences.filter(
      (licence) => citizenKey(licence) === value,
    );
    const nextLicenceId =
      matchingLicences.length === 1 ? matchingLicences[0].id : "";

    setSelectedLicenceId(nextLicenceId);
    setPointsToRemove(1);
    setSelectedScaleId("");
  }

  function handleLicenceChange(value: string) {
    setSelectedLicenceId(value);
    setPointsToRemove(1);
    setSelectedScaleId("");
  }

  function applyScale(entry: PointScaleEntry) {
    if (!selectedLicence || maxRemovablePoints <= 0) return;

    const appliedPoints = Math.min(entry.points, maxRemovablePoints);

    setActionType("points_deduction");
    setSelectedScaleId(entry.id);
    setPointsToRemove(appliedPoints);
    setSeverity(entry.severity);
    setReason(
      `Barème Nostra Circuit — ${entry.label} : ${entry.description}`,
    );
  }

  function selectManualPoints(points: number) {
    setSelectedScaleId("");
    setPointsToRemove(points);
  }

  const submitDisabled =
    !selectedCitizenId ||
    !selectedLicenceId ||
    (actionType === "points_deduction" && maxRemovablePoints <= 0);

  const submitLabel =
    actionType === "points_deduction"
      ? pointsToRemove > 0
        ? `Retirer ${pointsToRemove} point${pointsToRemove > 1 ? "s" : ""}`
        : "Aucun point disponible"
      : "Enregistrer la mesure";

  return (
    <form action={createCircuitDisciplinaryAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          <span>Citoyen concerné</span>
          <select
            name="holder_user_id"
            required
            value={selectedCitizenId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              handleCitizenChange(event.target.value)
            }
          >
            <option value="" disabled>
              Choisir un citoyen
            </option>
            {citizens.map((citizen) => (
              <option value={citizen.id} key={citizen.id}>
                {citizen.name} · {citizen.licenceCount} licence
                {citizen.licenceCount > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <small>
            Seuls les citoyens possédant au moins une licence Nostra Circuit
            apparaissent ici.
          </small>
        </label>

        <label>
          <span>Licence concernée</span>
          <select
            name="licence_id"
            required
            disabled={!selectedCitizenId}
            value={selectedLicenceId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              handleLicenceChange(event.target.value)
            }
          >
            <option value="" disabled>
              {selectedCitizenId
                ? "Choisir la licence concernée"
                : "Choisir d’abord un citoyen"}
            </option>
            {citizenLicences.map((licence) => (
              <option value={licence.id} key={licence.id}>
                {licence.licenceNumber} · {licence.licenceName} ·{" "}
                {licence.pointsRemaining}/12 pts
              </option>
            ))}
          </select>
          <small>
            La licence est sélectionnée automatiquement lorsque le citoyen
            n’en possède qu’une seule.
          </small>
        </label>
      </div>

      <section className={styles.scalePanel} aria-label="Barème de retrait de points">
        <div className={styles.scaleHeading}>
          <div>
            <span>BARÈME NOSTRA CIRCUIT</span>
            <h3>Points retirés selon l’infraction</h3>
          </div>
          <p>
            Sélectionne un citoyen et sa licence, puis clique sur une infraction.
            Le retrait, la gravité et le motif seront préremplis automatiquement.
          </p>
        </div>

        <div className={styles.scaleGrid}>
          {POINT_SCALE.map((entry) => {
            const unavailable =
              !selectedLicence || maxRemovablePoints <= 0;
            const appliedPoints = selectedLicence
              ? Math.min(entry.points, maxRemovablePoints)
              : entry.points;

            return (
              <button
                key={entry.id}
                type="button"
                disabled={unavailable}
                className={`${styles.scaleCard} ${
                  selectedScaleId === entry.id ? styles.scaleCardActive : ""
                }`}
                aria-pressed={selectedScaleId === entry.id}
                onClick={() => applyScale(entry)}
              >
                <span className={styles.scalePoints}>-{entry.points} pts</span>
                <strong>{entry.label}</strong>
                <small>{entry.description}</small>
                <span
                  className={`${styles.scaleSeverity} ${
                    styles[`scaleSeverity_${entry.severity}`]
                  }`}
                >
                  {SEVERITY_LABELS[entry.severity]}
                </span>
                {selectedLicence && appliedPoints < entry.points ? (
                  <em>
                    Retrait limité à -{appliedPoints} pt
                    {appliedPoints > 1 ? "s" : ""} selon le solde restant.
                  </em>
                ) : null}
              </button>
            );
          })}
        </div>

        {!selectedLicence ? (
          <p className={styles.scaleNotice}>
            Choisis d’abord le citoyen et la licence pour appliquer le barème.
          </p>
        ) : null}
      </section>

      <fieldset className={styles.measureFieldset}>
        <legend>Mesure disciplinaire</legend>
        <input type="hidden" name="action_type" value={actionType} />
        <div className={styles.measureChoices}>
          {ACTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.measureChoice} ${
                actionType === option.value ? styles.measureChoiceActive : ""
              }`}
              aria-pressed={actionType === option.value}
              onClick={() => setActionType(option.value)}
            >
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.grid}>
        <label>
          <span>Niveau de gravité</span>
          <select
            name="severity"
            value={severity}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setSeverity(event.target.value as DisciplineSeverity)
            }
          >
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
          <small>
            Laisse 0 pour une pénalité sportive sans montant financier.
          </small>
        </label>
      ) : null}

      {actionType === "points_deduction" ? (
        <section className={styles.pointsPanel} aria-label="Retrait de points">
          <input type="hidden" name="points_removed" value={pointsToRemove} />

          <div className={styles.pointsPanelHeader}>
            <div>
              <span>RETRAIT DE POINTS</span>
              <h3>Choisis ou ajuste le nombre de points à retirer</h3>
            </div>
            <div className={styles.currentPoints}>
              <small>Points actuels</small>
              <strong>
                {selectedLicence
                  ? `${selectedLicence.pointsRemaining}/12`
                  : "—/12"}
              </strong>
            </div>
          </div>

          {!selectedLicence ? (
            <p className={styles.pointsHelp}>
              Choisis d’abord le citoyen et la licence concernée.
            </p>
          ) : maxRemovablePoints <= 0 ? (
            <p className={styles.noPoints}>
              Cette licence n’a plus de point disponible. Aucun retrait
              supplémentaire n’est possible.
            </p>
          ) : (
            <>
              <div className={styles.pointButtons}>
                {Array.from(
                  { length: maxRemovablePoints },
                  (_, index) => index + 1,
                ).map((point) => (
                  <button
                    key={point}
                    type="button"
                    className={`${styles.pointButton} ${
                      pointsToRemove === point ? styles.pointButtonActive : ""
                    }`}
                    aria-pressed={pointsToRemove === point}
                    onClick={() => selectManualPoints(point)}
                  >
                    -{point}
                  </button>
                ))}
              </div>

              <div className={styles.pointsResult}>
                <span>Après la sanction</span>
                <strong>
                  {Math.max(0, maxRemovablePoints - pointsToRemove)}/12 points
                  restants
                </strong>
              </div>
            </>
          )}
        </section>
      ) : (
        <input type="hidden" name="points_removed" value="0" />
      )}

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
          value={reason}
          onChange={(event) => setReason(event.target.value)}
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
          Le citoyen recevra automatiquement une notification et la mesure sera
          ajoutée à l’historique permanent de la Direction. Le barème reste une
          référence : la Direction peut ajuster le retrait avant validation.
        </p>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitDisabled}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
