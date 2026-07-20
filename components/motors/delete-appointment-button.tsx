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
    >
      {pending ? "Suppression…" : "Supprimer le rendez-vous"}
    </button>
  );
}
