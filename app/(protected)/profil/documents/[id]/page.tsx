import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { replacePilotLicenseCertificate } from "@/app/actions/licenses";
import { PrintDocumentButton } from "@/components/documents/print-document-button";
import {
  OfficialPilotLicenseCard,
  type OfficialPilotLicensePayload,
} from "@/components/licenses/official-pilot-license-card";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PayloadItem = {
  item_type: "vehicle" | "delivery" | null;
  name: string;
  quantity: number;
  unit_price: number;
  delivery_address: string | null;
};

type OrderDocumentPayload = {
  order_number: string;
  customer_name: string;
  customer_note: string | null;
  admin_note: string | null;
  total: number;
  items: PayloadItem[];
  confirmed_at: string | null;
  delivered_at: string | null;
};

type LicenseDocumentPayload = {
  application_id: number;
  application_number: string;
  applicant_name: string;
  phone: string;
  email: string;
  license_code: string;
  license_label: string;
  amount: number;
  medical_certificate_path: string;
  medical_certificate_name: string;
  paid_at: string | null;
  license_status: string;
  review_note: string | null;
  official_license_document_id: number | null;
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function orderPayload(value: unknown): OrderDocumentPayload {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const rawItems = Array.isArray(source.items) ? source.items : [];

  const items = rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string") return [];

    return [
      {
        item_type:
          row.item_type === "vehicle"
            ? ("vehicle" as const)
            : row.item_type === "delivery"
              ? ("delivery" as const)
              : null,
        name: row.name,
        quantity: Math.max(1, Number(row.quantity) || 1),
        unit_price: Math.max(0, Number(row.unit_price) || 0),
        delivery_address:
          typeof row.delivery_address === "string"
            ? row.delivery_address
            : null,
      },
    ];
  });

  return {
    order_number:
      typeof source.order_number === "string"
        ? source.order_number
        : "Commande Nostra Motors",
    customer_name:
      typeof source.customer_name === "string"
        ? source.customer_name
        : "Client Nostra Motors",
    customer_note:
      typeof source.customer_note === "string"
        ? source.customer_note
        : null,
    admin_note:
      typeof source.admin_note === "string"
        ? source.admin_note
        : null,
    total: Math.max(0, Number(source.total) || 0),
    items,
    confirmed_at:
      typeof source.confirmed_at === "string"
        ? source.confirmed_at
        : null,
    delivered_at:
      typeof source.delivered_at === "string"
        ? source.delivered_at
        : null,
  };
}

function licensePayload(value: unknown): LicenseDocumentPayload {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    application_id: Math.max(0, Number(source.application_id) || 0),
    application_number:
      typeof source.application_number === "string"
        ? source.application_number
        : "Demande de licence",
    applicant_name:
      typeof source.applicant_name === "string"
        ? source.applicant_name
        : "Pilote",
    phone:
      typeof source.phone === "string"
        ? source.phone
        : "Non communiqué",
    email:
      typeof source.email === "string"
        ? source.email
        : "Non communiqué",
    license_code:
      typeof source.license_code === "string"
        ? source.license_code
        : "",
    license_label:
      typeof source.license_label === "string"
        ? source.license_label
        : "Licence pilote",
    amount: Math.max(0, Number(source.amount) || 0),
    medical_certificate_path:
      typeof source.medical_certificate_path === "string"
        ? source.medical_certificate_path
        : "",
    medical_certificate_name:
      typeof source.medical_certificate_name === "string"
        ? source.medical_certificate_name
        : "Certificat médical",
    paid_at:
      typeof source.paid_at === "string"
        ? source.paid_at
        : null,
    license_status:
      typeof source.license_status === "string"
        ? source.license_status
        : "under_review",
    review_note:
      typeof source.review_note === "string"
        ? source.review_note
        : null,
    official_license_document_id:
      source.official_license_document_id == null
        ? null
        : Number(source.official_license_document_id),
  };
}

function officialLicensePayload(
  value: unknown,
): OfficialPilotLicensePayload {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    application_id: Math.max(0, Number(source.application_id) || 0),
    application_number:
      typeof source.application_number === "string"
        ? source.application_number
        : "Demande de licence",
    license_number:
      typeof source.license_number === "string"
        ? source.license_number
        : "LICENCE NOSTRA",
    applicant_name:
      typeof source.applicant_name === "string"
        ? source.applicant_name
        : "Pilote",
    phone:
      typeof source.phone === "string"
        ? source.phone
        : "Non communiqué",
    email:
      typeof source.email === "string"
        ? source.email
        : "Non communiqué",
    license_code:
      typeof source.license_code === "string"
        ? source.license_code
        : "",
    license_label:
      typeof source.license_label === "string"
        ? source.license_label
        : "Licence pilote",
    status:
      typeof source.status === "string"
        ? source.status
        : "approved",
    issued_at:
      typeof source.issued_at === "string"
        ? source.issued_at
        : null,
    approved_at:
      typeof source.approved_at === "string"
        ? source.approved_at
        : null,
    season_year: Math.max(
      2026,
      Number(source.season_year) || 2026,
    ),
    review_note:
      typeof source.review_note === "string"
        ? source.review_note
        : null,
  };
}

export default async function ProfileDocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    certificate_replaced?: string;
    certificate_error?: string;
  }>;
}) {
  const [route, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const id = Number.parseInt(route.id, 10);

  if (!Number.isFinite(id) || id <= 0) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const { data: document, error } = await (supabase as any)
    .from("invoices")
    .select(
      "id,invoice_number,status,amount,issued_at,order_id,document_type,document_title,document_payload,license_status",
    )
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error || !document) notFound();

  const isOfficialLicense =
    document.document_type === "pilot_license_card";
  const isLicense =
    document.document_type === "license_application";

  if (isOfficialLicense) {
    const details = officialLicensePayload(document.document_payload);

    return (
      <main className={styles.page}>
        <div className={styles.toolbar}>
          <Link
            className="btn btn-secondary"
            href="/profil/documents"
          >
            ← Mes documents
          </Link>

          <PrintDocumentButton />
        </div>

        <OfficialPilotLicenseCard data={details} />
      </main>
    );
  }

  if (isLicense) {
    const details = licensePayload(document.document_payload);
    const licenseStatus =
      typeof document.license_status === "string"
        ? document.license_status
        : details.license_status;

    const licenseStatusLabel =
      licenseStatus === "approved"
        ? "Licence acceptée"
        : licenseStatus === "rejected"
          ? "Licence refusée"
          : licenseStatus === "new_certificate_requested"
            ? "Nouveau certificat demandé"
            : "Payée · à examiner";

    const certificateError =
      query.certificate_error === "missing"
        ? "Ajoute obligatoirement le nouveau certificat."
        : query.certificate_error === "type"
          ? "Le fichier doit être au format PDF, JPG ou PNG."
          : query.certificate_error === "size"
            ? "Le fichier dépasse la taille maximale de 10 Mo."
            : query.certificate_error
              ? "Le nouveau certificat n’a pas pu être envoyé."
              : null;

    let certificateUrl: string | null = null;

    if (details.medical_certificate_path) {
      const signed = await supabase.storage
        .from("license-medical-certificates")
        .createSignedUrl(
          details.medical_certificate_path,
          15 * 60,
        );

      certificateUrl = signed.data?.signedUrl ?? null;
    }

    return (
      <main className={styles.page}>
        <div className={styles.toolbar}>
          <Link
            className="btn btn-secondary"
            href="/profil/documents"
          >
            ← Mes documents
          </Link>

          <PrintDocumentButton />
        </div>

        <article className={styles.document}>
          <header className={styles.header}>
            <div>
              <span className={styles.brand}>NOSTRA CIRCUIT</span>
              <p>Administration sportive</p>
            </div>

            <div className={styles.reference}>
              <span>DEMANDE DE LICENCE</span>
              <strong>{document.invoice_number}</strong>
            </div>
          </header>

          <section className={styles.informationGrid}>
            <div>
              <span>PILOTE</span>
              <strong>{details.applicant_name}</strong>
            </div>

            <div>
              <span>LICENCE</span>
              <strong>{details.license_label}</strong>
            </div>

            <div>
              <span>DATE DU PAIEMENT</span>
              <strong>
                {new Date(
                  details.paid_at ?? document.issued_at,
                ).toLocaleDateString("fr-FR", {
                  dateStyle: "long",
                })}
              </strong>
            </div>

            <div>
              <span>STATUT</span>
              <strong>{licenseStatusLabel}</strong>
            </div>
          </section>

          {query.certificate_replaced === "1" && (
            <div className={styles.licenseSuccess}>
              Le nouveau certificat médical a bien été transmis à la
              Direction. Le dossier repasse en cours d’examen.
            </div>
          )}

          {certificateError && (
            <div className={styles.licenseError}>
              {certificateError}
            </div>
          )}

          {details.review_note && (
            <section className={styles.licenseDecision}>
              <span>MESSAGE DE LA DIRECTION</span>
              <p>{details.review_note}</p>
            </section>
          )}

          {details.official_license_document_id &&
            licenseStatus === "approved" && (
              <section className={styles.licenseSuccess}>
                La licence officielle a été générée.
                {' '}
                <Link
                  href={`/profil/documents/${details.official_license_document_id}`}
                >
                  Ouvrir ma licence pilote →
                </Link>
              </section>
            )}

          <section className={styles.items}>
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Qté</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>
                    <strong>{details.license_label}</strong>
                    {details.license_code && (
                      <small>Catégorie : {details.license_code}</small>
                    )}
                  </td>
                  <td>1</td>
                  <td>{money(document.amount)}</td>
                  <td>{money(document.amount)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className={styles.total}>
            <span>TOTAL PAYÉ</span>
            <strong>{money(document.amount)}</strong>
          </section>

          <section className={styles.notes}>
            <div>
              <span>COORDONNÉES DU PILOTE</span>
              <p>
                Téléphone : {details.phone}
                {"\n"}
                E-mail : {details.email}
              </p>
            </div>

            <div>
              <span>CERTIFICAT MÉDICAL</span>
              <p>{details.medical_certificate_name}</p>

              {certificateUrl ? (
                <p>
                  <a
                    href={certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir le certificat médical ↗
                  </a>
                </p>
              ) : (
                <p>Le fichier n’est pas disponible actuellement.</p>
              )}
            </div>
          </section>

          {licenseStatus === "new_certificate_requested" && (
            <section className={styles.replacement}>
              <span>NOUVEAU CERTIFICAT DEMANDÉ</span>
              <h2>Remplacer mon certificat médical</h2>
              <p>
                La Direction a demandé un nouveau document. Le certificat
                actuel sera remplacé après l’envoi.
              </p>

              <form
                action={replacePilotLicenseCertificate}
                encType="multipart/form-data"
              >
                <input
                  type="hidden"
                  name="application_id"
                  value={details.application_id}
                />
                <input
                  type="hidden"
                  name="document_id"
                  value={document.id}
                />
                <input
                  name="medical_certificate"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  required
                />
                <button type="submit">
                  Envoyer le nouveau certificat
                </button>
              </form>
            </section>
          )}

          <footer className={styles.footer}>
            <p>
              Ce document confirme le paiement et le dépôt de la
              demande. La licence reste soumise à l’examen du dossier
              médical par le Nostra Circuit.
            </p>

            <strong>Nostra Circuit · Bell-Île-en-Mer · 2026</strong>
          </footer>
        </article>
      </main>
    );
  }

  const details = orderPayload(document.document_payload);
  const isOrderForm = document.document_type === "order_form";

  const deliveryAddresses = [
    ...new Set(
      details.items
        .map((item) => item.delivery_address)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Link
          className="btn btn-secondary"
          href="/profil/documents"
        >
          ← Mes documents
        </Link>

        <PrintDocumentButton />
      </div>

      <article className={styles.document}>
        <header className={styles.header}>
          <div>
            <span className={styles.brand}>NOSTRA MOTORS</span>
            <p>L’exclusivité prend la route.</p>
          </div>

          <div className={styles.reference}>
            <span>
              {isOrderForm ? "BON DE COMMANDE" : "FACTURE"}
            </span>
            <strong>{document.invoice_number}</strong>
          </div>
        </header>

        <section className={styles.informationGrid}>
          <div>
            <span>CLIENT</span>
            <strong>{details.customer_name}</strong>
          </div>

          <div>
            <span>COMMANDE</span>
            <strong>{details.order_number}</strong>
          </div>

          <div>
            <span>DATE DU DOCUMENT</span>
            <strong>
              {new Date(
                document.issued_at,
              ).toLocaleDateString("fr-FR", {
                dateStyle: "long",
              })}
            </strong>
          </div>

          <div>
            <span>STATUT</span>
            <strong>
              {isOrderForm
                ? "Commande confirmée"
                : "Véhicule livré"}
            </strong>
          </div>
        </section>

        {deliveryAddresses.length > 0 && (
          <section className={styles.delivery}>
            <span>ADRESSE DE LIVRAISON</span>
            {deliveryAddresses.map((address) => (
              <strong key={address}>{address}</strong>
            ))}
          </section>
        )}

        <section className={styles.items}>
          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th>Qté</th>
                <th>Prix unitaire</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {details.items.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.delivery_address && (
                      <small>
                        Livraison : {item.delivery_address}
                      </small>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>
                    {money(item.quantity * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.total}>
          <span>TOTAL</span>
          <strong>{money(document.amount)}</strong>
        </section>

        {(details.customer_note || details.admin_note) && (
          <section className={styles.notes}>
            {details.customer_note && (
              <div>
                <span>MESSAGE DU CLIENT</span>
                <p>{details.customer_note}</p>
              </div>
            )}

            {details.admin_note && (
              <div>
                <span>MESSAGE DE NOSTRA MOTORS</span>
                <p>{details.admin_note}</p>
              </div>
            )}
          </section>
        )}

        <footer className={styles.footer}>
          <p>
            {isOrderForm
              ? "Ce bon de commande confirme la prise en charge de la commande par Nostra Motors."
              : "Cette facture est générée automatiquement à la livraison du véhicule."}
          </p>

          <strong>Nostra Motors · Bell-Île-en-Mer · 2026</strong>
        </footer>
      </article>
    </main>
  );
}
