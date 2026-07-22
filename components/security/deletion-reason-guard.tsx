"use client";

import { useEffect } from "react";

const DELETION_CONFIRMATION_WORDS =
  /(supprim|effac|retir|delete|remove|définitif|definitif|irréversible|irreversible)/i;

/**
 * V71
 *
 * Les demandes globales de motif de suppression sont désactivées.
 * Les anciennes confirmations navigateur liées à une suppression sont
 * validées automatiquement, sans afficher de fenêtre au citoyen ou au staff.
 * Les confirmations sans rapport avec une suppression restent inchangées.
 */
export function DeletionReasonGuard() {
  useEffect(() => {
    const nativeConfirm = window.confirm.bind(window);

    window.confirm = (message?: string) => {
      const confirmationMessage = String(message ?? "");

      if (DELETION_CONFIRMATION_WORDS.test(confirmationMessage)) {
        return true;
      }

      return nativeConfirm(confirmationMessage);
    };

    return () => {
      window.confirm = nativeConfirm;
    };
  }, []);

  return null;
}
