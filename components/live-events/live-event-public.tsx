"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveEventBoard } from "@/lib/live-events/types";
import { EventBoardDisplay } from "./event-board-display";
import styles from "./live-events.module.css";

export function LiveEventPublic({ initialEvents }: { initialEvents: LiveEventBoard[] }) {
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let timer: number | null = null;

    const refresh = async () => {
      const { data, error } = await supabase
        .from("live_event_boards")
        .select("*")
        .in("status", ["live", "completed"])
        .order("status", { ascending: false })
        .order("updated_at", { ascending: false });
      if (active && !error && Array.isArray(data)) setEvents(data as LiveEventBoard[]);
    };

    const scheduleRefresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void refresh();
      }, 80);
    };

    const channel = supabase
      .channel("live-event-boards-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_event_boards" }, scheduleRefresh)
      .subscribe();
    const fallback = window.setInterval(() => void refresh(), 5000);

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, []);

  if (events.length === 0) {
    return <div className={styles.emptyPublic}>Aucun événement n’est diffusé en direct pour le moment.</div>;
  }

  return <div className={styles.publicList}>{events.map((event) => <EventBoardDisplay event={event} key={event.id} />)}</div>;
}
