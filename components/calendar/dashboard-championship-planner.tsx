"use client";

import { useState } from "react";
import { saveEvent } from "@/app/actions/backoffice";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DashboardChampionshipPlanner({ championship, label }: { championship: "f1" | "gt3rs"; label: string }) {
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  const [startTime, setStartTime] = useState("21:00");
  const [endTime, setEndTime] = useState("");
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  return (
    <article className="backoffice-panel championship-planner">
      <div className="panel-heading"><span className="panel-icon">📅</span><div><h2>{label}</h2><p>Clique sur un jour, puis renseigne l’horaire et les informations de la manche.</p></div></div>
      <div className="dashboard-calendar-compact">
        <div className="calendar-toolbar">
          <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
          <h3>{MONTHS[month]} {year}</h3>
          <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
        </div>
        <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => day ? (
            <button type="button" key={day} className={`calendar-day ${selectedDate === dateKey(year, month, day) ? "calendar-day-selected" : ""}`} onClick={() => setSelectedDate(dateKey(year, month, day))}><strong>{day}</strong></button>
          ) : <span className="calendar-day calendar-day-empty" key={`empty-${index}`} />)}
        </div>
      </div>
      <form action={saveEvent} className="backoffice-form backoffice-form-wide planner-form">
        <input type="hidden" name="championship" value={championship} />
        <input type="hidden" name="dashboard_target" value="championnats" />
        <label>Titre<input name="title" required placeholder={`Exemple : Manche ${label}`} /></label>
        <label>Lieu<input name="location" defaultValue="Nostra Circuit" /></label>
        <label>Statut<select name="status" defaultValue="published"><option value="draft">Brouillon</option><option value="published">Publié</option><option value="cancelled">Annulé</option><option value="completed">Terminé</option></select></label>
        <label>Date choisie<input name="starts_date" value={selectedDate} readOnly /></label>
        <label>Heure de début<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
        <label>Heure de fin<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        <input type="hidden" name="starts_at" value={`${selectedDate}T${startTime}`} />
        <input type="hidden" name="ends_at" value={endTime ? `${selectedDate}T${endTime}` : ""} />
        <label className="checkbox-label"><input type="checkbox" name="registration_open" /> Inscriptions ouvertes</label>
        <label className="form-span-3">Description<textarea name="description" rows={4} placeholder="Informations de la manche, programme, consignes…" /></label>
        <button className="btn" type="submit">Publier dans le calendrier</button>
      </form>
    </article>
  );
}

