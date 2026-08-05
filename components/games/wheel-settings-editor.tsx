"use client";

import { useState } from "react";
import { saveWheelConfiguration } from "@/app/actions/games";
import type { WheelSegment } from "@/lib/games/wheel-config";

type EditableSegment = Omit<WheelSegment, "index" | "prizeKey">;

function normalizeIndexes(segments: EditableSegment[]): WheelSegment[] {
  return segments.map((segment, index) => ({
    ...segment,
    index,
    prizeKey: segment.type === "loss" ? `loss_${index}` : `custom_${index}`,
  }));
}

export function WheelSettingsEditor({
  enabled,
  disabledMessage,
  initialSegments,
}: {
  enabled: boolean;
  disabledMessage: string;
  initialSegments: WheelSegment[];
}) {
  const [segments, setSegments] = useState<EditableSegment[]>(
    initialSegments.map(({ label, shortLabel, type, color, textColor }) => ({ label, shortLabel, type, color, textColor })),
  );

  function updateSegment(index: number, patch: Partial<EditableSegment>) {
    setSegments((current) => current.map((segment, position) => position === index ? { ...segment, ...patch } : segment));
  }

  function moveSegment(index: number, direction: -1 | 1) {
    setSegments((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addSegment() {
    if (segments.length >= 40) return;
    setSegments((current) => [...current, {
      label: "Nouveau gain",
      shortLabel: "GAIN",
      type: "bonus",
      color: "#b98918",
      textColor: "#ffffff",
    }]);
  }

  function removeSegment(index: number) {
    if (segments.length <= 2) return;
    setSegments((current) => current.filter((_, position) => position !== index));
  }

  return (
    <form action={saveWheelConfiguration} className="wheel-settings-form">
      <input type="hidden" name="segments" value={JSON.stringify(normalizeIndexes(segments))} />

      <section className="backoffice-panel wheel-settings-panel">
        <div className="panel-heading">
          <span className="panel-icon">⚙</span>
          <div>
            <h2>Ouverture de la roue</h2>
            <p>Active ou désactive le jeu et choisis le message visible par les citoyens.</p>
          </div>
        </div>

        <label className="wheel-activation-control">
          <input name="enabled" type="checkbox" defaultChecked={enabled} />
          <span><strong>Roue disponible côté citoyen</strong><small>Si elle est désactivée, aucun tirage ne peut être enregistré.</small></span>
        </label>

        <label className="wheel-disabled-message-field">
          <span>Message affiché lorsque la roue est désactivée</span>
          <textarea name="disabled_message" rows={3} maxLength={500} required defaultValue={disabledMessage} />
        </label>
      </section>

      <section className="backoffice-panel wheel-segments-panel">
        <div className="panel-heading wheel-segments-heading">
          <span className="panel-icon">🎡</span>
          <div>
            <h2>Cases de la roue</h2>
            <p>{segments.length} cases. Modifie uniquement celles que tu souhaites puis enregistre toute la roue.</p>
          </div>
          <button className="btn wheel-add-segment" type="button" onClick={addSegment} disabled={segments.length >= 40}>+ Ajouter une case</button>
        </div>

        <div className="wheel-segment-editor-list">
          {segments.map((segment, index) => (
            <article className="wheel-segment-editor" key={index}>
              <div className="wheel-segment-number" style={{ backgroundColor: segment.color, color: segment.textColor }}>{index + 1}</div>
              <label className="wheel-segment-label-field">
                <span>Gain affiché</span>
                <input value={segment.label} onChange={(event) => updateSegment(index, { label: event.target.value })} maxLength={100} required />
              </label>
              <label>
                <span>Texte court sur la roue</span>
                <input value={segment.shortLabel} onChange={(event) => updateSegment(index, { shortLabel: event.target.value.toUpperCase() })} maxLength={18} required />
              </label>
              <label>
                <span>Résultat</span>
                <select value={segment.type} onChange={(event) => updateSegment(index, { type: event.target.value === "loss" ? "loss" : "bonus" })}>
                  <option value="bonus">Gain</option>
                  <option value="loss">Perdu</option>
                </select>
              </label>
              <label className="wheel-color-field">
                <span>Couleur case</span>
                <input type="color" value={segment.color} onChange={(event) => updateSegment(index, { color: event.target.value })} />
              </label>
              <label className="wheel-color-field">
                <span>Couleur texte</span>
                <input type="color" value={segment.textColor} onChange={(event) => updateSegment(index, { textColor: event.target.value })} />
              </label>
              <div className="wheel-segment-editor-actions">
                <button type="button" onClick={() => moveSegment(index, -1)} disabled={index === 0} aria-label={`Monter la case ${index + 1}`}>↑</button>
                <button type="button" onClick={() => moveSegment(index, 1)} disabled={index === segments.length - 1} aria-label={`Descendre la case ${index + 1}`}>↓</button>
                <button className="wheel-remove-segment" type="button" onClick={() => removeSegment(index)} disabled={segments.length <= 2}>Supprimer</button>
              </div>
            </article>
          ))}
        </div>

        <div className="wheel-settings-save-bar">
          <p>Les nouvelles cases seront utilisées immédiatement pour les prochains tirages.</p>
          <button className="btn" type="submit">Enregistrer la roue</button>
        </div>
      </section>
    </form>
  );
}
