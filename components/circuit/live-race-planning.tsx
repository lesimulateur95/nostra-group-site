"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommissionerRaceBriefing } from "@/lib/backoffice/data";

function value(value: string | null | undefined, fallback = "À confirmer") {
  return value?.trim() || fallback;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(`${date}T12:00:00`));
}

export function LiveRacePlanning({ initialPlanning }: { initialPlanning: CommissionerRaceBriefing | null }) {
  const [planning, setPlanning] = useState(initialPlanning);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("nostra-live-race-planning")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commissioner_race_briefing", filter: "id=eq.1" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setPlanning(null);
            return;
          }
          setPlanning(payload.new as CommissionerRaceBriefing);
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="live-planning-board" aria-live="polite">
      <header className="live-planning-header">
        <div>
          <span className="eyebrow">PLANNING COURSE EN DIRECT</span>
          <h1>{value(planning?.event_title, "Aucun événement programmé")}</h1>
          <p>{formatDate(planning?.event_date)}</p>
        </div>
        <span className={`live-connection-status ${connected ? "is-connected" : ""}`}>
          <i aria-hidden="true" />{connected ? "Actualisation instantanée" : "Connexion au direct…"}
        </span>
      </header>

      {planning?.live_announcement?.trim() && (
        <div className="live-planning-announcement">
          <span>ANNONCE DE LA DIRECTION DE COURSE</span>
          <strong>{planning.live_announcement}</strong>
        </div>
      )}

      <div className="live-planning-grid">
        <article><span>🟢 Ouverture des stands</span><strong>{value(planning?.stands_opening)}</strong></article>
        <article><span>🟡 Qualifications</span><strong>{value(planning?.qualifications_time)}</strong></article>
        <article><span>🏁 Départ</span><strong>{value(planning?.race_start)}</strong></article>
        <article><span>🏎️ Véhicule</span><strong>{value(planning?.vehicle)}</strong></article>
        <article><span>🔢 Nombre de tours</span><strong>{value(planning?.lap_count)}</strong></article>
        <article><span>🌦️ Météo</span><strong>{value(planning?.weather)}</strong></article>
      </div>

      <div className="live-planning-details">
        <article><span>Commissaires présents</span><p>{value(planning?.commissioners, "À affecter")}</p></article>
        <article><span>Direction de course</span><p>{value(planning?.race_direction, "À confirmer")}</p></article>
      </div>

      <footer className="live-planning-footer">
        <span>Les informations changent automatiquement dès qu’un commissaire enregistre une modification.</span>
        {planning?.updated_at && <small>Dernière mise à jour : {new Date(planning.updated_at).toLocaleString("fr-FR")}</small>}
      </footer>
    </section>
  );
}
