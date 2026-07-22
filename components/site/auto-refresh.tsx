"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef } from "react";

const MIN_DELAY_AFTER_INTERACTION_MS = 10_000;
const REFRESH_LOCK_MS = 5_000;

/**
 * Les rafraîchissements complets Next.js restent réservés aux pages qui en ont
 * réellement besoin. Les délais sont volontairement espacés pour éviter de
 * relancer en boucle les composants serveur et les requêtes Supabase.
 */
function refreshIntervalForPath(pathname: string): number | null {
  // Ces pages disposent déjà de leur propre synchronisation plus précise.
  if (
    pathname.startsWith("/dashboard/commissaires/chronometrage/") ||
    pathname.startsWith("/evenements/bingo") ||
    pathname === "/accueil"
  ) {
    return null;
  }

  if (pathname === "/dashboard/commissaires") {
    return 20_000;
  }

  if (
    pathname.startsWith("/dashboard/commandes") ||
    pathname.startsWith("/dashboard/livraisons") ||
    pathname.startsWith("/dashboard/rendez-vous-motors")
  ) {
    return 30_000;
  }

  if (pathname.startsWith("/dashboard/messagerie")) {
    return 45_000;
  }

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/evenements") ||
    pathname.startsWith("/dashboard/circuit")
  ) {
    return 60_000;
  }

  // Les pages classiques ne sont jamais rechargées automatiquement.
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
  const refreshUnlockTimer = useRef<number | null>(null);
  const visibilityTimer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    if (
      document.visibilityState !== "visible" ||
      userIsEditing() ||
      refreshLocked.current ||
      Date.now() - lastInteractionAt.current < MIN_DELAY_AFTER_INTERACTION_MS
    ) {
      return;
    }

    refreshLocked.current = true;

    startTransition(() => {
      router.refresh();
    });

    if (refreshUnlockTimer.current !== null) {
      window.clearTimeout(refreshUnlockTimer.current);
    }

    refreshUnlockTimer.current = window.setTimeout(() => {
      refreshLocked.current = false;
      refreshUnlockTimer.current = null;
    }, REFRESH_LOCK_MS);
  }, [router]);

  useEffect(() => {
    const intervalMs = refreshIntervalForPath(pathname);

    if (intervalMs === null) return;

    const registerInteraction = () => {
      lastInteractionAt.current = Date.now();
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;

      if (visibilityTimer.current !== null) {
        window.clearTimeout(visibilityTimer.current);
      }

      // Une seule actualisation après le retour sur l'onglet, sans rafale.
      visibilityTimer.current = window.setTimeout(() => {
        refresh();
        visibilityTimer.current = null;
      }, 1_000);
    };

    const interval = window.setInterval(refresh, intervalMs);

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pointerdown", registerInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", registerInteraction);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pointerdown", registerInteraction);
      window.removeEventListener("keydown", registerInteraction);
      document.removeEventListener("visibilitychange", refreshWhenVisible);

      if (refreshUnlockTimer.current !== null) {
        window.clearTimeout(refreshUnlockTimer.current);
        refreshUnlockTimer.current = null;
      }

      if (visibilityTimer.current !== null) {
        window.clearTimeout(visibilityTimer.current);
        visibilityTimer.current = null;
      }

      refreshLocked.current = false;
    };
  }, [pathname, refresh]);

  return null;
}
