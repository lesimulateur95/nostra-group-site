"use client";

import { useEffect, useMemo, useState } from "react";
import { submitCircuitReservation } from "@/app/actions/backoffice";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateKey(date: Date) {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function slotDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
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
  const [now, setNow] = useState<Date | null>(null);
  const initialToday = new Date();
  const [viewDate, setViewDate] = useState(new Date(initialToday.getFullYear(), initialToday.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [localError, setLocalError] = useState("");
  const occupied = useMemo(() => new Set(occupiedSlots), [occupiedSlots]);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const referenceNow = now ?? initialToday;
  const today = startOfDay(referenceNow);
  const todayKey = localDateKey(referenceNow);

  const isPastSlot = (date: string, time: string) => {
    if (!now) return false;
    return slotDate(date, time).getTime() <= now.getTime();
  };

  const slotStatus = (date: string, time: string) => {
    if (occupied.has(`${date}|${time}`)) return "reserved" as const;
    if (isPastSlot(date, time)) return "past" as const;
    return "available" as const;
  };

  const availableTimesForDate = (date: string) => TIMES.filter((time) => slotStatus(date, time) === "available");

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

  const chooseDate = (key: string) => {
    const firstAvailable = availableTimesForDate(key)[0] ?? "";
    setSelectedDate(key);
    setSelectedTime(firstAvailable);
    setLocalError(firstAvailable ? "" : "Aucun horaire n’est disponible pour cette journée.");
  };

  const selectedLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Choisis d’abord un jour dans le calendrier";

  const selectedSlotStatus = selectedDate && selectedTime ? slotStatus(selectedDate, selectedTime) : null;

  return (
    <section className="booking-calendar-layout">
      <div className="calendar-panel">
        <div className="calendar-toolbar">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Mois précédent">‹</button>
          <h2>{MONTHS[month]} {year}</h2>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Mois suivant">›</button>
        </div>

        <div className="reservation-calendar-legend" aria-label="Légende du calendrier">
          <span><i className="legend-dot legend-dot-available" /> Disponible</span>
          <span><i className="legend-dot legend-dot-reserved" /> Réservé</span>
          <span><i className="legend-dot legend-dot-past" /> Passé</span>
        </div>

        <div className="calendar-weekdays">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-day calendar-day-empty" key={`empty-${index}`} />;
            const key = dateKey(year, month, day);
            const date = new Date(year, month, day);
            const pastDay = date < today;
            const reservedCount = TIMES.filter((time) => occupied.has(`${key}|${time}`)).length;
            const availableCount = availableTimesForDate(key).length;
            const unavailable = pastDay || availableCount === 0;
            const isToday = key === todayKey;

            return (
              <button
                type="button"
                key={key}
                disabled={unavailable}
                className={`calendar-day ${selectedDate === key ? "calendar-day-selected" : ""} ${availableCount === 0 ? "calendar-day-full" : ""} ${reservedCount > 0 ? "calendar-day-has-reservations" : ""}`}
                onClick={() => chooseDate(key)}
              >
                <strong>{day}</strong>
                <span className="calendar-day-meta">
                  {isToday && !pastDay && <small>Aujourd’hui</small>}
                  {reservedCount > 0 && <small className="calendar-day-reserved-count">{reservedCount} réservé{reservedCount > 1 ? "s" : ""}</small>}
                  {!pastDay && availableCount > 0 && <small>{availableCount} disponible{availableCount > 1 ? "s" : ""}</small>}
                  {pastDay && <small>Passé</small>}
                  {!pastDay && availableCount === 0 && <small>Complet</small>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="time-panel">
        <p className="eyebrow">CRÉNEAU CHOISI</p>
        <h2>{selectedLabel}</h2>
        <p className="time-panel-help">
          {selectedDate ? "Choisis un horaire disponible. Les créneaux validés par la direction sont marqués « Réservé »." : "Sélectionne d’abord une journée disponible."}
        </p>
        <div className="time-slot-grid">
          {TIMES.map((time) => {
            const status = selectedDate ? slotStatus(selectedDate, time) : "unselected";
            const unavailable = status !== "available";
            const label = status === "reserved" ? "Réservé" : status === "past" ? "Passé" : status === "available" ? "Disponible" : "Choisir un jour";
            return (
              <button
                type="button"
                key={time}
                disabled={unavailable}
                className={`${selectedTime === time ? "time-slot-selected" : ""} time-slot-${status}`}
                onClick={() => { setSelectedTime(time); setLocalError(""); }}
              >
                <strong>{time}</strong>
                <small>{label}</small>
              </button>
            );
          })}
        </div>
      </div>

      <form
        action={submitCircuitReservation}
        className="booking-request-form"
        onSubmit={(event) => {
          if (!selectedDate || !selectedTime || selectedSlotStatus !== "available") {
            event.preventDefault();
            setLocalError("Choisis une date et un horaire disponibles avant d’envoyer la demande.");
          }
        }}
      >
        <input type="hidden" name="reservation_date" value={selectedDate} />
        <input type="hidden" name="reservation_time" value={selectedTime} />
        <div className="booking-form-heading">
          <p className="eyebrow">FORMULAIRE DE RÉSERVATION</p>
          <h2>Envoyer la demande</h2>
          <p>Le créneau sera marqué « Réservé » uniquement après validation par la direction du circuit.</p>
        </div>
        {localError && <div className="dashboard-feedback dashboard-feedback-error form-span-2" role="alert">{localError}</div>}
        <label>Prénom<input name="first_name" defaultValue={initialFirstName} required minLength={2} /></label>
        <label>Nom<input name="last_name" defaultValue={initialLastName} required minLength={2} /></label>
        <label className="form-span-2">Motif de la réservation<textarea name="reason" rows={5} required minLength={3} placeholder="Exemple : essais privés, événement, entraînement d’écurie…" /></label>
        <div className="booking-selection-summary form-span-2">
          <span>Date</span><strong>{selectedDate || "Non choisie"}</strong>
          <span>Heure</span><strong>{selectedTime || "Non choisie"}</strong>
          <span>Statut</span><strong>{selectedSlotStatus === "available" ? "Disponible" : "À choisir"}</strong>
        </div>
        <button className="btn form-span-2" type="submit" disabled={!selectedDate || !selectedTime || selectedSlotStatus !== "available"}>Envoyer la demande de créneau</button>
      </form>
    </section>
  );
}
