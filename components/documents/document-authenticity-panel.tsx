import Link from "next/link";

import { DocumentQr } from "@/components/documents/document-qr";
import {
  effectiveStatus,
  signatureStatusLabel,
  verificationStatusLabel,
} from "@/lib/documents/format";
import type { DocumentRegistryRow } from "@/lib/documents/types";

import styles from "./document-authenticity-panel.module.css";

export function DocumentAuthenticityPanel({
  document,
  allowSignature = false,
}: {
  document: DocumentRegistryRow;
  allowSignature?: boolean;
}) {
  const status = effectiveStatus(document);
  const canSign =
    allowSignature &&
    document.signable &&
    document.signature_status === "pending" &&
    status === "valid";

  return (
    <aside className={styles.panel} aria-label="Authenticité du document">
      <div className={styles.copy}>
        <p>DOCUMENT OFFICIEL NOSTRA GROUP</p>
        <h2>Authenticité et signature</h2>
        <dl>
          <div>
            <dt>Numéro</dt>
            <dd>{document.document_number}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd data-status={status}>{verificationStatusLabel(status)}</dd>
          </div>
          <div>
            <dt>Signature</dt>
            <dd data-signature={document.signature_status}>
              {signatureStatusLabel(document.signature_status)}
            </dd>
          </div>
          {document.signed_at && (
            <div>
              <dt>Signé le</dt>
              <dd>
                {new Date(document.signed_at).toLocaleString("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          )}
        </dl>
        {canSign && (
          <Link
            className={styles.signLink}
            href={`/profil/documents/signature/${document.id}`}
          >
            Signer électroniquement ce document
          </Link>
        )}
      </div>
      <DocumentQr code={document.verification_code} size={132} />
    </aside>
  );
}
