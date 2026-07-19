"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { spinWheel, type SpinWheelResponse } from "@/app/actions/games";
import { WHEEL_SEGMENT_COUNT, WHEEL_SEGMENTS } from "@/lib/games/wheel-config";

const CENTER = 200;
const RADIUS = 188;
const LABEL_RADIUS = 137;
const SEGMENT_ANGLE = 360 / WHEEL_SEGMENT_COUNT;

function pointAt(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

function segmentPath(index: number) {
  const startAngle = -90 + index * SEGMENT_ANGLE;
  const endAngle = -90 + (index + 1) * SEGMENT_ANGLE;
  const start = pointAt(RADIUS, startAngle);
  const end = pointAt(RADIUS, endAngle);
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y} Z`;
}

function resultMessage(result: NonNullable<SpinWheelResponse["spin"]>) {
  if (result.prize_type === "loss") return "Cette fois, la roue s’arrête sur Perdu. Un nouveau tirage sera disponible demain à 00h00.";
  return "Ton gain est enregistré dans Mon profil → Jeux. Présente-le à l’équipe lorsqu’il sera utilisé.";
}

export function WheelGame({ configured, alreadySpunToday }: { configured: boolean; alreadySpunToday: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rotation, setRotation] = useState(0);
  const [displayedResult, setDisplayedResult] = useState<NonNullable<SpinWheelResponse["spin"]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyUsed, setDailyUsed] = useState(alreadySpunToday);
  const paths = useMemo(() => WHEEL_SEGMENTS.map((segment) => ({ ...segment, path: segmentPath(segment.index) })), []);

  function handleSpin() {
    if (!configured || isPending || dailyUsed) return;
    setDisplayedResult(null);
    setError(null);

    startTransition(async () => {
      const response = await spinWheel();
      if (!response.ok || !response.spin) {
        if (response.error === "daily_limit") setDailyUsed(true);
        setError(response.error === "setup"
          ? "La roue doit d’abord être activée depuis Dashboard → Jeux → Roue de la chance."
          : response.error === "auth"
            ? "Reconnecte-toi avec Discord avant de tourner la roue."
            : response.error === "daily_limit"
              ? "Ton tirage du jour est déjà utilisé. Le prochain sera disponible à 00h00, heure de France."
              : "La roue n’a pas pu enregistrer le résultat. Réessaie dans un instant.");
        return;
      }

      setDailyUsed(true);

      const targetModulo = (360 - (response.spin.slot_index + 0.5) * SEGMENT_ANGLE + 360) % 360;
      setRotation((current) => {
        const currentModulo = ((current % 360) + 360) % 360;
        const delta = (targetModulo - currentModulo + 360) % 360;
        return current + 6 * 360 + delta;
      });

      window.setTimeout(() => {
        setDisplayedResult(response.spin ?? null);
        router.refresh();
      }, 4650);
    });
  }

  return (
    <section className="wheel-game-shell">
      <div className="wheel-stage">
        <div className="wheel-pointer" aria-hidden="true"><span /></div>
        <div className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
          <svg className="wheel-svg" viewBox="0 0 400 400" role="img" aria-label="Roue de la chance Nostra Group avec 23 cases">
            <circle cx={CENTER} cy={CENTER} r={196} className="wheel-outer-ring" />
            {paths.map((segment) => {
              const middleAngle = -90 + (segment.index + 0.5) * SEGMENT_ANGLE;
              const labelPoint = pointAt(LABEL_RADIUS, middleAngle);
              return (
                <g key={`${segment.index}-${segment.prizeKey}`}>
                  <path d={segment.path} fill={segment.color} className="wheel-segment" />
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    fill={segment.textColor}
                    className="wheel-segment-label"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${middleAngle + 90} ${labelPoint.x} ${labelPoint.y})`}
                  >
                    {segment.shortLabel}
                  </text>
                </g>
              );
            })}
            <circle cx={CENTER} cy={CENTER} r={54} className="wheel-center-disc" />
            <text x={CENTER} y={CENTER - 5} className="wheel-center-title" textAnchor="middle">NOSTRA</text>
            <text x={CENTER} y={CENTER + 17} className="wheel-center-subtitle" textAnchor="middle">CHANCE</text>
          </svg>
        </div>
        <button className="wheel-spin-button" type="button" onClick={handleSpin} disabled={!configured || isPending || dailyUsed}>
          {isPending ? "Tirage…" : dailyUsed ? "TIRAGE DU JOUR UTILISÉ" : "TOURNER LA ROUE"}
        </button>
      </div>

      <aside className="wheel-result-panel" aria-live="polite">
        <p className="eyebrow">RÉSULTAT DU TIRAGE</p>
        {!configured && <div className="wheel-result-empty wheel-result-error"><strong>Activation nécessaire</strong><span>Le Gérant doit exécuter le SQL V29 depuis le Dashboard.</span></div>}
        {configured && dailyUsed && !displayedResult && !error && <div className="wheel-result-empty"><strong>Tirage du jour déjà utilisé</strong><span>La roue sera de nouveau disponible à 00h00, heure de France. Les tirages non utilisés ne se cumulent pas.</span></div>}
        {configured && !dailyUsed && !displayedResult && !error && <div className="wheel-result-empty"><strong>La roue est prête</strong><span>Tu disposes d’un seul tirage par jour, remis à zéro à 00h00.</span></div>}
        {error && <div className="wheel-result-empty wheel-result-error"><strong>Impossible de lancer la roue</strong><span>{error}</span></div>}
        {displayedResult && (
          <div className={`wheel-result-card ${displayedResult.prize_type === "loss" ? "wheel-result-loss" : "wheel-result-win"}`}>
            <span>{displayedResult.prize_type === "loss" ? "✕" : "◆"}</span>
            <div><small>{displayedResult.prize_type === "loss" ? "DOMMAGE" : "FÉLICITATIONS"}</small><strong>{displayedResult.prize_label}</strong><p>{resultMessage(displayedResult)}</p></div>
          </div>
        )}
      </aside>
    </section>
  );
}
