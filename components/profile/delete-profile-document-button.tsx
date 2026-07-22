"use client";

import { useFormStatus } from "react-dom";

import { deleteOwnProfileDocument } from "@/app/actions/profile-documents";

import styles from "./delete-profile-document-button.module.css";

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.button} type="submit" disabled={pending}>
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

export function DeleteProfileDocumentButton({
  documentId,
}: {
  documentId: number;
}) {
  return (
    <form
      className={styles.form}
      action={deleteOwnProfileDocument}
      onSubmit={(event) => {
        if (!window.confirm("Supprimer définitivement ce document de ton profil ?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="document_id" value={documentId} />
      <DeleteButton />
    </form>
  );
}
