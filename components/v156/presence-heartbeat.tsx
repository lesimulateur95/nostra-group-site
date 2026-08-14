"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function PresenceHeartbeatV156() {
  const pathname = usePathname();

  useEffect(() => {
    let stopped = false;

    const send = async () => {
      if (stopped) return;
      try {
        await fetch("/api/presence-v156", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ path: pathname || "/" }),
          keepalive: true,
        });
      } catch {}
    };

    void send();
    const id = window.setInterval(() => void send(), 20_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void send();
    };
    const onFocus = () => void send();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  return null;
}
