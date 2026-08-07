"use client";

import { useState } from "react";

import { deleteOwnAccount } from "@/app/actions/account";

import styles from "@/app/(protected)/profil/compte/page.module.css";

const REQUIRED_TEXT = "SUPPRIMER MON COMPTE";

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const ready =
    understood && confirmation.trim().toUpperCase() === REQUIRED_TEXT;

  return (
    <form action={deleteOwnAccount} className={styles.deleteForm}>
      <label className={styles.checkRow}>
        <input
          name="understood"
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
        />
        <span>
          Je comprends que cette action est définitive et que je perdrai l'accès
          à ce compte.
        </span>
      </label>

      <label className={styles.confirmField}>
        <span>
          Pour confirmer, écris <strong>{REQUIRED_TEXT}</strong>
        </span>
        <input
          autoComplete="off"
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={REQUIRED_TEXT}
        />
      </label>

      <button className={styles.deleteButton} type="submit" disabled={!ready}>
        Supprimer définitivement mon compte
      </button>
    </form>
  );
}
