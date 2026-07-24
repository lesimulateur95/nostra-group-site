"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const MIN_DELAY_AFTER_INTERACTION_MS = 12_000;

/**
 * Un router.refresh() recharge toutes les requêtes serveur de la page.
 * Il est donc réservé aux écrans qui ont réellement besoin d'une mise à jour
 * périodique. Les pages lourdes du Dashboard ne sont plus rechargées en boucle.
 */
function refreshIntervalForPath(pathname: string): number | null {
  if (
    pathname.startsWith("/dashboard/commissaires/chronometrage/") ||
    pathname.startsWith("/evenements/bingo") ||
    pathname === "/accueil"
  ) {
    return null;
  }

  if (
    pathname.startsWith("/dashboard/commandes") ||
    pathname.startsWith("/dashboard/livraisons") ||
    pathname.startsWith("/dashboard/rendez-vous-motors")
  ) {
    return 60_000;
  }

  if (pathname.startsWith("/dashboard/messagerie")) {
    return 90_000;
  }

  if (pathname === "/dashboard/commissaires") {
    return 90_000;
  }

  // Dashboard principal, état des activités, événements et pages classiques :
  // aucune recharge complète automatique. Les données sont actualisées lors de
  // la navigation ou après une action, grâce à revalidatePath/router.refresh.
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
        Date.now() - lastInteractionAt.current < MIN_DELAY_AFTER_INTERACTION_MS
      ) {
        return;
      }

      refreshLocked.current = true;
      router.refresh();
      window.setTimeout(() => {
        refreshLocked.current = false;
      }, 4_000);
    };

    const interval = window.setInterval(refresh, intervalMs);
    window.addEventListener("pointerdown", registerInteraction, { passive: true });
    window.addEventListener("keydown", registerInteraction);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", registerInteraction);
      window.removeEventListener("keydown", registerInteraction);
    };
  }, [pathname, router]);

  return null;
}
