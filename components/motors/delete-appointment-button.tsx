"use client";

import { useFormStatus } from "react-dom";

import styles from "@/components/motors/motors-services.module.css";

export function DeleteAppointmentButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className={styles.deleteButton}
      type="submit"
      disabled={pending}
      onClick={(event) => {
        const confirmed = window.confirm(
          "Supprimer définitivement cette prise de rendez-vous ? Cette action est irréversible.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Suppression…" : "Supprimer le rendez-vous"}
    </button>
  );
}
