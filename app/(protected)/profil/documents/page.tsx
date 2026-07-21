import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DocumentType =
  | "order_form"
  | "invoice"
  | "license_application";

type DocumentRow = {
  id: number;
  invoice_number: string;
  status: string;
  amount: number | string;
  issued_at: string;
  download_url: string | null;
  order_id: number | null;
  document_type: DocumentType;
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

function documentLabel(type: DocumentType) {
  if (type === "order_form") return "Bon de commande";
  if (type === "license_application") {
    return "Demande de licence";
  }
  return "Facture";
}

function statusLabel(
  status: string,
  type: DocumentType,
  licenseStatus: string | null,
) {
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
    return type === "order_form" ? "Confirmé" : "Émise";
  }

  if (status === "paid") return "Payée";
  return status;
}

export default async function ProfileDocumentsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const modern = await (supabase as any)
    .from("invoices")
    .select(
      "id,invoice_number,status,amount,issued_at,download_url,order_id,document_type,document_title,license_status",
    )
    .eq("user_id", authData.user.id)
    .order("issued_at", { ascending: false });

  let documents: DocumentRow[] = [];

  if (!modern.error) {
    documents = (modern.data ?? []) as DocumentRow[];
  } else {
    const legacy = await supabase
      .from("invoices")
      .select(
        "id,invoice_number,status,amount,issued_at,download_url",
      )
      .eq("user_id", authData.user.id)
      .order("issued_at", { ascending: false });

    documents = (legacy.data ?? []).map((row) => ({
      ...row,
      order_id: null,
      document_type: "invoice" as const,
      document_title: "Facture Nostra Group",
      license_status: null,
    }));
  }

  return (
    <>
      <ProfileSectionHeader
        eyebrow="ESPACE DOCUMENTAIRE"
        title="Documents & factures"
        description="Retrouve les bons de commande, les factures et les demandes de licence pilote payées depuis le site."
      />

      <section className="profile-data-section profile-standalone-section">
        <div className="profile-data-heading">
          <div>
            <p className="eyebrow">DOCUMENTS AUTOMATIQUES</p>
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
              </tr>
            </thead>

            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    Aucun document disponible.
                  </td>
                </tr>
              )}

              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <strong>
                      {documentLabel(document.document_type)}
                    </strong>

                    {document.document_title && (
                      <small className="order-client-note">
                        {document.document_title}
                      </small>
                    )}
                  </td>

                  <td>{document.invoice_number}</td>

                  <td>
                    {new Date(
                      document.issued_at,
                    ).toLocaleDateString("fr-FR")}
                  </td>

                  <td>
                    {statusLabel(
                      document.status,
                      document.document_type,
                      document.license_status,
                    )}
                  </td>

                  <td>{money(document.amount)}</td>

                  <td>
                    <Link href={`/profil/documents/${document.id}`}>
                      Ouvrir →
                    </Link>

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
