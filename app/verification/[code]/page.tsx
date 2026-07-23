import Link from "next/link";

import { DocumentQr } from "@/components/documents/document-qr";
import {
  signatureStatusLabel,
  verificationStatusLabel,
} from "@/lib/documents/format";
import type { PublicDocumentVerification } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";

import styles from "./verification.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VerificationResult = PublicDocumentVerification;

function formatDate(value: string | null, withTime = false): string {
  if (!value) return "Non renseignée";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export default async function PublicDocumentVerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const normalizedCode = decodeURIComponent(code).trim();

  const { data, error } = await (supabase as any).rpc(
    "verify_nostra_document",
    { p_code: normalizedCode },
  );

  const document = !error && Array.isArray(data) && data.length
    ? (data[0] as VerificationResult)
    : null;

  if (!document) {
    return (
      <main className={styles.page}>
        <section className={styles.notFound}>
          <div className={styles.logo}>N</div>
          <p>VÉRIFICATION OFFICIELLE</p>
          <h1>Document introuvable</h1>
          <span>
            Aucun document Nostra Group ne correspond au code
            <strong> {normalizedCode || "non renseigné"}</strong>.
          </span>
          <Link href="/">Retour au site Nostra Group</Link>
        </section>
      </main>
    );
  }

  const statusLabel = verificationStatusLabel(document.verification_status);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.brand}>
          <span>N</span>
          <div>
            <strong>NOSTRA GROUP</strong>
            <small>Registre public d’authenticité</small>
          </div>
        </div>
        <p>DOCUMENT OFFICIEL VÉRIFIÉ</p>
        <h1>{document.document_title}</h1>
        <div
          className={styles.status}
          data-status={document.verification_status}
        >
          {statusLabel}
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardHeading}>
            <div>
              <p>INFORMATIONS CERTIFIÉES</p>
              <h2>Vérification du document</h2>
            </div>
            <span>{document.document_number}</span>
          </div>

          <dl className={styles.details}>
            <div>
              <dt>Nom du citoyen</dt>
              <dd>{document.citizen_name}</dd>
            </div>
            <div>
              <dt>Type de document</dt>
              <dd>{document.document_title}</dd>
            </div>
            <div>
              <dt>Numéro officiel</dt>
              <dd>{document.document_number}</dd>
            </div>
            <div>
              <dt>Date de création</dt>
              <dd>{formatDate(document.issued_at)}</dd>
            </div>
            <div>
              <dt>Date d’expiration</dt>
              <dd>{document.expires_at ? formatDate(document.expires_at) : "Sans expiration"}</dd>
            </div>
            <div>
              <dt>Signature</dt>
              <dd>{signatureStatusLabel(document.signature_status)}</dd>
            </div>
          </dl>

          {document.signature_status === "signed" && (
            <div className={styles.signature}>
              <strong>Signature électronique enregistrée</strong>
              <span>
                Signé par {document.signer_name || document.citizen_name}
              </span>
              <span>{formatDate(document.signed_at, true)}</span>
            </div>
          )}

          {document.verification_status === "cancelled" && (
            <div className={styles.warning}>
              Ce document a été annulé par la Direction Nostra Group. Il ne doit
              plus être considéré comme valide.
            </div>
          )}

          {document.verification_status === "expired" && (
            <div className={styles.warning}>
              Ce document est authentique, mais sa période de validité est
              terminée.
            </div>
          )}
        </article>

        <aside className={styles.qrCard}>
          <p>CODE UNIQUE</p>
          <h2>Authenticité publique</h2>
          <DocumentQr code={document.verification_code} size={220} />
          <small>
            Ce résultat provient directement du registre sécurisé Nostra Group.
          </small>
        </aside>
      </section>

      <footer className={styles.footer}>
        <Link href="/">nostra-group-site.vercel.app</Link>
        <span>Code : {document.verification_code}</span>
      </footer>
    </main>
  );
}
