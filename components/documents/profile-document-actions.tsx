import Link from "next/link";

import {
  effectiveStatus,
  signatureStatusLabel,
  verificationStatusLabel,
} from "@/lib/documents/format";
import type { DocumentRegistryRow } from "@/lib/documents/types";

import styles from "./profile-document-actions.module.css";

export function ProfileDocumentActions({
  document,
}: {
  document: DocumentRegistryRow | null;
}) {
  if (!document) {
    return <span className={styles.pendingSetup}>QR en préparation</span>;
  }

  const status = effectiveStatus(document);
  const canSign =
    document.signable &&
    document.signature_status === "pending" &&
    status === "valid";

  return (
    <div className={styles.root}>
      <Link
        href={`/verification/${encodeURIComponent(document.verification_code)}`}
        target="_blank"
        className={styles.verify}
      >
        Vérifier le QR ↗
      </Link>
      <span className={styles.status} data-status={status}>
        {verificationStatusLabel(status)}
      </span>
      {canSign ? (
        <Link
          href={`/profil/documents/signature/${document.id}`}
          className={styles.sign}
        >
          Signer
        </Link>
      ) : (
        <span
          className={styles.signature}
          data-signature={document.signature_status}
        >
          {signatureStatusLabel(document.signature_status)}
        </span>
      )}
    </div>
  );
}
