import Link from "next/link";
import { redirect } from "next/navigation";

import { changeNostraDocumentStatus } from "@/app/actions/document-signatures";
import { DocumentQr } from "@/components/documents/document-qr";
import { Topbar } from "@/components/site/topbar";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  documentTypeLabel,
  effectiveStatus,
  verificationStatusLabel,
  verificationUrl,
} from "@/lib/documents/format";
import type { DocumentRegistryRow } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";

import styles from "./documents-signes.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{
  error?: string;
  updated?: string;
}>;

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export default async function SignedDocumentsStockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [supabase, query] = await Promise.all([createClient(), searchParams]);
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const roles = await getUserRoleKeys(authData.user);
  const hasAccess = roles.some((role) =>
    ["manager", "commercial", "employee"].includes(role),
  );
  if (!hasAccess) redirect("/accueil");

  const isManager = roles.includes("manager");
  const result = await (supabase as any)
    .from("nostra_document_registry")
    .select(
      "id,verification_code,document_number,owner_user_id,citizen_name,document_type,document_title,source_table,source_id,status,issued_at,expires_at,signable,signature_status,signed_at,signed_by,signer_name,metadata",
    )
    .eq("signature_status", "signed")
    .order("signed_at", { ascending: false })
    .limit(500);

  const documents = !result.error
    ? ((result.data ?? []) as DocumentRegistryRow[])
    : [];
  const activeCount = documents.filter(
    (document) => effectiveStatus(document) === "valid",
  ).length;
  const cancelledCount = documents.filter(
    (document) => effectiveStatus(document) === "cancelled",
  ).length;

  return (
    <div className={styles.shell}>
      <Topbar />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p>DIRECTION · DOCUMENTS OFFICIELS</p>
            <h1>Stock des documents signés</h1>
            <span>
              Registre commun accessible aux Gérants, Commerciaux et Employés.
              Seul le Gérant peut annuler ou réactiver un document.
            </span>
          </div>
          <Link href="/dashboard">← Retour au Dashboard</Link>
        </section>

        {query.error && <div className={styles.error}>{query.error}</div>}
        {query.updated && (
          <div className={styles.success}>
            Statut du document mis à jour avec succès.
          </div>
        )}
        {result.error && (
          <div className={styles.error}>
            Le registre V72 n’est pas encore disponible : {result.error.message}
          </div>
        )}

        <section className={styles.stats}>
          <article>
            <span>Total signé</span>
            <strong>{documents.length}</strong>
          </article>
          <article>
            <span>Documents valides</span>
            <strong>{activeCount}</strong>
          </article>
          <article>
            <span>Documents annulés</span>
            <strong>{cancelledCount}</strong>
          </article>
        </section>

        <section className={styles.registry}>
          <div className={styles.registryHeading}>
            <div>
              <p>ARCHIVES SIGNÉES</p>
              <h2>Documents signés par les citoyens</h2>
            </div>
            <span>{documents.length} document(s)</span>
          </div>

          {!documents.length ? (
            <div className={styles.empty}>
              Aucun document signé pour le moment.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Citoyen</th>
                    <th>Signature</th>
                    <th>Statut</th>
                    <th>Vérification</th>
                    <th>Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => {
                    const status = effectiveStatus(document);
                    const nextStatus =
                      document.status === "cancelled" ? "valid" : "cancelled";

                    return (
                      <tr key={document.id}>
                        <td>
                          <strong>
                            {documentTypeLabel(
                              document.document_type,
                              document.document_title,
                            )}
                          </strong>
                          <small>{document.document_number}</small>
                        </td>
                        <td>
                          <strong>{document.citizen_name}</strong>
                        </td>
                        <td>
                          <strong>{document.signer_name || document.citizen_name}</strong>
                          <small>{formatDate(document.signed_at)}</small>
                        </td>
                        <td>
                          <span data-status={status} className={styles.status}>
                            {verificationStatusLabel(status)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.verifyCell}>
                            <DocumentQr
                              code={document.verification_code}
                              size={62}
                              compact
                            />
                            <a
                              href={verificationUrl(document.verification_code)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Vérifier ↗
                            </a>
                          </div>
                        </td>
                        <td>
                          {isManager ? (
                            <form action={changeNostraDocumentStatus}>
                              <input
                                type="hidden"
                                name="document_id"
                                value={document.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value={nextStatus}
                              />
                              <button
                                type="submit"
                                data-action={nextStatus}
                                className={styles.statusButton}
                              >
                                {nextStatus === "cancelled"
                                  ? "Annuler"
                                  : "Réactiver"}
                              </button>
                            </form>
                          ) : (
                            <span className={styles.readOnly}>Consultation</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
