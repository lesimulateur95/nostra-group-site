"use client";

import { useMemo, useState } from "react";
import { submitCircuitReservation } from "@/app/actions/backoffice";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function ReservationCalendar({
  occupiedSlots,
  initialFirstName,
  initialLastName,
}: {
  occupiedSlots: string[];
  initialFirstName: string;
  initialLastName: string;
}) {
  const today = startOfToday();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const occupied = useMemo(() => new Set(occupiedSlots), [occupiedSlots]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (next < currentMonth) return;
    setViewDate(next);
  };

  const selectedLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Choisis d’abord un jour dans le calendrier";

  return (
    <section className="booking-calendar-layout">
      <div className="calendar-panel">
        <div className="calendar-toolbar">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Mois précédent">‹</button>
          <h2>{MONTHS[month]} {year}</h2>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Mois suivant">›</button>
        </div>
        <div className="calendar-weekdays">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-day calendar-day-empty" key={`empty-${index}`} />;
            const key = dateKey(year, month, day);
            const date = new Date(year, month, day);
            const past = date < today;
            const fullyBooked = TIMES.every((time) => occupied.has(`${key}|${time}`));
            return (
              <button
                type="button"
                key={key}
                disabled={past || fullyBooked}
                className={`calendar-day ${selectedDate === key ? "calendar-day-selected" : ""} ${fullyBooked ? "calendar-day-full" : ""}`}
                onClick={() => { setSelectedDate(key); setSelectedTime(""); }}
              >
                <strong>{day}</strong>
                {fullyBooked && <small>Complet</small>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="time-panel">
        <p className="eyebrow">CRÉNEAU CHOISI</p>
        <h2>{selectedLabel}</h2>
        <div className="time-slot-grid">
          {TIMES.map((time) => {
            const unavailable = !selectedDate || occupied.has(`${selectedDate}|${time}`);
            return (
              <button
                type="button"
                key={time}
                disabled={unavailable}
                className={selectedTime === time ? "time-slot-selected" : ""}
                onClick={() => setSelectedTime(time)}
              >
                {time}
                {selectedDate && occupied.has(`${selectedDate}|${time}`) && <small>Réservé</small>}
              </button>
            );
          })}
        </div>
      </div>

      <form action={submitCircuitReservation} className="booking-request-form">
        <input type="hidden" name="reservation_date" value={selectedDate} />
        <input type="hidden" name="reservation_time" value={selectedTime} />
        <div className="booking-form-heading">
          <p className="eyebrow">FORMULAIRE DE RÉSERVATION</p>
          <h2>Envoyer la demande</h2>
          <p>Le créneau sera bloqué uniquement après validation par la direction du circuit.</p>
        </div>
        <label>Prénom<input name="first_name" defaultValue={initialFirstName} required /></label>
        <label>Nom<input name="last_name" defaultValue={initialLastName} required /></label>
        <label className="form-span-2">Motif de la réservation<textarea name="reason" rows={5} required placeholder="Exemple : essais privés, événement, entraînement d’écurie…" /></label>
        <div className="booking-selection-summary form-span-2">
          <span>Date</span><strong>{selectedDate || "Non choisie"}</strong>
          <span>Heure</span><strong>{selectedTime || "Non choisie"}</strong>
        </div>
        <button className="btn form-span-2" type="submit" disabled={!selectedDate || !selectedTime}>Envoyer la demande de créneau</button>
      </form>
    </section>
  );
}
