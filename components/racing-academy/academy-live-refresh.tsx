"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AcademyLiveRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <span title="Actualisation automatique toutes les 5 secondes" style={{ color: "#8f949f", fontSize: ".78rem" }}>
      ● Suivi en direct
    </span>
  );
}
