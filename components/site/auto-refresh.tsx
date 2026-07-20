
"use client";

import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useRef,
} from "react";

const MIN_DELAY_AFTER_INTERACTION_MS = 4_000;

function refreshIntervalForPath(pathname: string): number | null {
  // Ces pages disposent déjà de leur propre synchronisation plus précise.
  if (
    pathname.startsWith(
      "/dashboard/commissaires/chronometrage/",
    ) ||
    pathname.startsWith("/evenements/bingo") ||
    pathname === "/accueil"
  ) {
    return null;
  }

  if (pathname === "/dashboard/commissaires") {
    return 6_000;
  }

  if (pathname.startsWith("/dashboard/commandes")) {
    return 8_000;
  }

  if (pathname.startsWith("/dashboard/messagerie")) {
    return 10_000;
  }

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/evenements") ||
    pathname.startsWith("/dashboard/circuit")
  ) {
    return 15_000;
  }

  // Les pages classiques ne sont plus rechargées en permanence.
  return null;
}

function userIsEditing(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  return (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    activeElement.getAttribute("contenteditable") === "true"
  );
}

export function AutoRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const refreshLocked = useRef(false);
  const lastInteractionAt = useRef(Date.now());

  useEffect(() => {
    const intervalMs = refreshIntervalForPath(pathname);
    if (intervalMs === null) return;

    const registerInteraction = () => {
      lastInteractionAt.current = Date.now();
    };

    const refresh = () => {
      if (
        document.visibilityState !== "visible" ||
        userIsEditing() ||
        refreshLocked.current ||
        Date.now() - lastInteractionAt.current <
          MIN_DELAY_AFTER_INTERACTION_MS
      ) {
        return;
      }

      refreshLocked.current = true;
      router.refresh();

      window.setTimeout(() => {
        refreshLocked.current = false;
      }, 1_500);
    };

    const interval = window.setInterval(refresh, intervalMs);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(refresh, 500);
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pointerdown", registerInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", registerInteraction);
    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener(
        "pointerdown",
        registerInteraction,
      );
      window.removeEventListener(
        "keydown",
        registerInteraction,
      );
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
    };
  }, [pathname, router]);

  return null;
}
