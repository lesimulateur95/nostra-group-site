"use client";

import { useEffect } from "react";

export type HashRoute = {
  hash: string;
  href: string;
  aliases?: string[];
};

function normalizeHash(value: string): string {
  return decodeURIComponent(value.replace(/^#/, "")).trim().toLowerCase();
}

export function HashRouteRedirect({ routes }: { routes: HashRoute[] }) {
  useEffect(() => {
    const redirectFromHash = () => {
      const current = normalizeHash(window.location.hash);
      if (!current) return;

      const route = routes.find((item) => {
        const candidates = [item.hash, ...(item.aliases ?? [])].map(normalizeHash);
        return candidates.includes(current);
      });

      if (route) {
        // Navigation complète pour éliminer définitivement les anciennes URL en #fragment.
        window.location.replace(route.href);
      }
    };

    redirectFromHash();
    window.addEventListener("hashchange", redirectFromHash);
    return () => window.removeEventListener("hashchange", redirectFromHash);
  }, [routes]);

  return null;
}
