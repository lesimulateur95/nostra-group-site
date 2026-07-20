
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 3_000;

function userIsEditing() {
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
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState !== "visible" ||
        userIsEditing()
      ) {
        return;
      }

      router.refresh();
    };

    const interval = window.setInterval(
      refresh,
      REFRESH_INTERVAL_MS,
    );

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
    };
  }, [router]);

  return null;
}
