"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { GlobalCountdownV156 } from "@/lib/v156/data";
import styles from "./v156.module.css";

function remaining(end: string | null) {
  if (!end) return 0;
  return Math.max(0, new Date(end).getTime() - Date.now());
}

function label(ms: number) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days > 0 ? `${days}j ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function GlobalCountdownV156({ countdown }: { countdown: GlobalCountdownV156 | null }) {
  const [ms, setMs] = useState(() => remaining(countdown?.endsAt ?? null));
  useEffect(() => {
    if (!countdown?.enabled || !countdown.endsAt) return;
    const tick = () => setMs(remaining(countdown.endsAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);
  const visible = useMemo(() => Boolean(countdown?.enabled && countdown.endsAt && ms > 0), [countdown, ms]);
  if (!visible || !countdown) return null;
  return (
    <div className={styles.countdownGlobal}>
      <strong>{countdown.title}</strong>
      {countdown.subtitle && <span>{countdown.subtitle}</span>}
      <span className={styles.countdownGlobalTime}>{label(ms)}</span>
      {countdown.targetUrl && <Link href={countdown.targetUrl}>Découvrir →</Link>}
    </div>
  );
}
