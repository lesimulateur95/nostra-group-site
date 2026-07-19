"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CalendarEvent = {
  id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function keyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ChampionshipCalendar({ events, title, refreshKey }: { events: CalendarEvent[]; title: string; refreshKey?: "f1" | "gt3rs" | "reservations" }) {
  const [initial] = useState(() => {
    const now = new Date();
    const firstEvent = events.find((event) => new Date(event.starts_at).getTime() >= now.getTime());
    return firstEvent ? new Date(firstEvent.starts_at) : now;
  });
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(keyFromDate(initial));
  const [liveEvents, setLiveEvents] = useState(events);


  useEffect(() => {
    if (!refreshKey) return;
    const supabase = createClient();
    let active = true;

    const refreshEvents = async () => {
      if (refreshKey === "reservations") {
        const { data, error } = await supabase
          .from("circuit_reservation_requests")
          .select("id,reason,reservation_date,reservation_time,status")
          .eq("status", "approved")
          .order("reservation_date", { ascending: true })
          .order("reservation_time", { ascending: true });
        if (!active || error) return;
        setLiveEvents((data ?? []).map((request) => ({
          id: request.id,
          title: "Créneau réservé",
          description: request.reason ?? "",
          location: "Nostra Circuit",
          starts_at: `${request.reservation_date}T${String(request.reservation_time).slice(0, 5)}:00`,
          ends_at: null,
          status: request.status,
        })));
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,location,starts_at,ends_at,status")
        .eq("championship", refreshKey)
        .eq("status", "published")
        .order("starts_at", { ascending: true });
      if (!active || error) return;
      setLiveEvents((data ?? []) as CalendarEvent[]);
    };

    const onFocus = () => void refreshEvents();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshEvents();
    };

    void refreshEvents();
    const timer = window.setInterval(() => void refreshEvents(), 10_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshKey]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of liveEvents) {
      const key = keyFromDate(new Date(event.starts_at));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [liveEvents]);
  const selectedEvents = grouped.get(selectedDay) ?? [];

  return (
    <section className="championship-calendar-shell">
      <div className="calendar-panel">
        <div className="calendar-toolbar">
          <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
          <div><p className="eyebrow">{title}</p><h2>{MONTHS[month]} {year}</h2></div>
          <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
        </div>
        <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-day calendar-day-empty" key={`empty-${index}`} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const count = grouped.get(key)?.length ?? 0;
            return (
              <button type="button" key={key} className={`calendar-day ${selectedDay === key ? "calendar-day-selected" : ""}`} onClick={() => setSelectedDay(key)}>
                <strong>{day}</strong>
                {count > 0 && <small>{count} événement{count > 1 ? "s" : ""}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="calendar-event-detail">
        <p className="eyebrow">PROGRAMME DU JOUR</p>
        <h2>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        {selectedEvents.length === 0 && <p className="empty-calendar-copy">Aucun événement prévu ce jour-là.</p>}
        {selectedEvents.map((event) => (
          <article key={event.id}>
            <span>{new Date(event.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            <h3>{event.title}</h3>
            {event.location && <p>📍 {event.location}</p>}
            {event.description && <p>{event.description}</p>}
          </article>
        ))}
      </aside>
    </section>
  );
}
