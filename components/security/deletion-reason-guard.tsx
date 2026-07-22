"use client";

import { useEffect, useState } from "react";

const DELETE_WORDS = /\b(supprimer|effacer définitivement|delete)\b/i;

export function DeletionReasonGuard() {
  const [required, setRequired] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/security/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { required?: boolean }) => {
        if (active) setRequired(Boolean(payload.required));
      })
      .catch(() => {
        if (active) setRequired(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!required) return;

    const handler = async (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("button, a, [role='button'], input[type='submit']")
        : null;
      if (!target || target.dataset.deletionReasonReady === "true") return;

      const text = target instanceof HTMLInputElement
        ? target.value
        : target.textContent ?? target.getAttribute("aria-label") ?? "";
      if (!DELETE_WORDS.test(text)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const reason = window.prompt(
        "Motif obligatoire : pourquoi cet élément doit-il être supprimé ?",
      )?.trim();
      if (!reason) return;
      if (reason.length < 4) {
        window.alert("Le motif doit contenir au moins 4 caractères.");
        return;
      }

      const response = await fetch("/api/security/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        window.alert(payload.error ?? "Impossible d’enregistrer le motif.");
        return;
      }

      target.dataset.deletionReasonReady = "true";
      target.click();
      window.setTimeout(() => {
        delete target.dataset.deletionReasonReady;
      }, 1000);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [required]);

  return null;
}
