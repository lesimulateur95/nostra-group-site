"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteVehicleFinancingApplication } from "@/app/actions/vehicle-financing";

import styles from "./delete-financing-application-button.module.css";

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.confirm} type="submit" disabled={pending}>
      {pending ? "Suppression…" : "Oui, supprimer définitivement"}
    </button>
  );
}

export function DeleteFinancingApplicationButton({
  applicationId,
  applicationNumber,
  isInProgress,
}: {
  applicationId: number;
  applicationNumber: string;
  isInProgress: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        className={styles.open}
        type="button"
        onClick={() => setConfirming(true)}
      >
        Supprimer le dossier
      </button>
    );
  }

  return (
    <form className={styles.confirmation} action={deleteVehicleFinancingApplication}>
      <input type="hidden" name="application_id" value={applicationId} />
      <div>
        <strong>Supprimer {applicationNumber} ?</strong>
        <p>
          Le dossier, ses échéances et ses lignes de panier seront supprimés.
          {isInProgress
            ? " Le véhicule réservé sera remis en stock. Les paiements déjà effectués ne seront pas remboursés automatiquement."
            : " Cette action est définitive."}
        </p>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.cancel}
          type="button"
          onClick={() => setConfirming(false)}
        >
          Annuler
        </button>
        <ConfirmDeleteButton />
      </div>
    </form>
  );
}
