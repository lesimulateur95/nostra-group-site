import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileDocumentActions } from "@/components/documents/profile-document-actions";
import { DeleteProfileDocumentButton } from "@/components/profile/delete-profile-document-button";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import type { DocumentRegistryRow } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DocumentRow = {
  id: number;
  invoice_number: string;
  status: string;
  amount: number | string;
  issued_at: string;
  download_url: string | null;
  order_id: number | null;
  document_type: string;
  document_title: string | null;
  license_status: string | null;
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function documentLabel(document: DocumentRow) {
  if (document.document_title?.trim()) return document.document_title.trim();
  if (document.document_type === "order_form") return "Bon de commande";
  if (document.document_type === "license_application") {
    return "Demande de licence";
  }
  if (document.document_type === "pilot_license_card") {
    return "Licence officielle";
  }
  if (document.document_type === "certificate") return "Certificat";
  if (document.document_type === "contract") return "Contrat";
  return "Facture";
}

function statusLabel(
  status: string,
  type: string,
  licenseStatus: string | null,
) {
  if (type === "pilot_license_card") {
    return licenseStatus === "approved" ? "Licence active" : "Disponible";
  }
  if (type === "license_application") {
    if (licenseStatus === "approved") return "Validée";
    if (licenseStatus === "rejected") return "Refusée";
    if (licenseStatus === "new_certificate_requested") {
      return "Nouveau certificat demandé";
    }
    return "Payée · à examiner";
  }
  if (status === "available") return "Disponible";
  if (status === "issued") {
    return type === "order_form" ? "Confirmé" : "Émis";
  }
  if (status === "paid") return "Payée";
  return status;
}

function invoiceIdFromRegistry(document: DocumentRegistryRow): string | null {
  const value = document.metadata?.invoice_id;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return document.source_table === "invoices" ? document.source_id : null;
}

export default async function ProfileDocumentsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const [modern, registryResult] = await Promise.all([
    (supabase as any)
      .from("invoices")
      .select(
        "id,invoice_number,status,amount,issued_at,download_url,order_id,document_type,document_title,license_status",
      )
      .eq("user_id", authData.user.id)
      .order("issued_at", { ascending: false }),
    (supabase as any)
      .from("nostra_document_registry")
      .select(
        "id,verification_code,document_number,owner_user_id,citizen_name,document_type,document_title,source_table,source_id,status,issued_at,expires_at,signable,signature_status,signed_at,signed_by,signer_name,metadata",
      )
      .eq("owner_user_id", authData.user.id)
      .order("issued_at", { ascending: false })
      .limit(1000),
  ]);

  let documents: DocumentRow[] = [];

  if (!modern.error) {
    documents = (modern.data ?? []) as DocumentRow[];
  } else {
    const legacy = await supabase
      .from("invoices")
      .select("id,invoice_number,status,amount,issued_at,download_url")
      .eq("user_id", authData.user.id)
      .order("issued_at", { ascending: false });

    documents = (legacy.data ?? []).map((row: {
      id: number;
      invoice_number: string;
      status: string;
      amount: number | string;
      issued_at: string;
      download_url: string | null;
    }) => ({
      ...row,
      order_id: null,
      document_type: "invoice",
      document_title: "Facture Nostra Group",
      license_status: null,
    }));
  }

  const registry = !registryResult.error
    ? ((registryResult.data ?? []) as DocumentRegistryRow[])
    : [];
  const registryByInvoice = new Map<string, DocumentRegistryRow>();

  for (const item of registry) {
    const invoiceId = invoiceIdFromRegistry(item);
    if (invoiceId && !registryByInvoice.has(invoiceId)) {
      registryByInvoice.set(invoiceId, item);
    }
  }

  return (
    <>
      <ProfileSectionHeader
        eyebrow="ESPACE DOCUMENTAIRE"
        title="Documents & factures"
        description="Retrouve, vérifie et signe tes bons de commande, factures, certificats, contrats et licences officielles. Les achats gagnés dans les jeux ne demandent pas de signature."
      />

      <section className="profile-data-section profile-standalone-section">
        <div className="profile-data-heading">
          <div>
            <p className="eyebrow">DOCUMENTS OFFICIELS</p>
            <h2>Mes documents</h2>
          </div>
          <span>{documents.length}</span>
        </div>

        <div className="profile-table-wrap">
          <table className="profile-data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Référence</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Montant</th>
                <th>Document</th>
                <th>QR & signature</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    Aucun document disponible.
                  </td>
                </tr>
              )}

              {documents.map((document) => {
                const documentHref = document.download_url?.startsWith("/")
                  ? document.download_url
                  : `/profil/documents/${document.id}`;
                const registryDocument =
                  registryByInvoice.get(String(document.id)) ?? null;

                return (
                  <tr key={document.id}>
                    <td>
                      <strong>{documentLabel(document)}</strong>
                    </td>
                    <td>{document.invoice_number}</td>
                    <td>
                      {new Date(document.issued_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td>
                      {statusLabel(
                        document.status,
                        document.document_type,
                        document.license_status,
                      )}
                    </td>
                    <td>
                      {document.document_type === "pilot_license_card"
                        ? "—"
                        : money(document.amount)}
                    </td>
                    <td>
                      <Link href={documentHref}>Ouvrir →</Link>
                      {document.download_url?.startsWith("http") && (
                        <>
                          {" · "}
                          <a
                            href={document.download_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Fichier externe ↗
                          </a>
                        </>
                      )}
                    </td>
                    <td>
                      <ProfileDocumentActions document={registryDocument} />
                    </td>
                    <td>
                      <DeleteProfileDocumentButton documentId={document.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
