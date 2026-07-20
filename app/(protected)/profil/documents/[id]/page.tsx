
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintDocumentButton } from "@/components/documents/print-document-button";
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

type DocumentPayload = {
  order_number: string;
  customer_name: string;
  customer_note: string | null;
  admin_note: string | null;
  total: number;
  items: PayloadItem[];
  confirmed_at: string | null;
  delivered_at: string | null;
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function payload(value: unknown): DocumentPayload {
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

export default async function ProfileDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const route = await params;
  const id = Number.parseInt(route.id, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: document, error } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,status,amount,issued_at,order_id,document_type,document_title,document_payload",
    )
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error || !document) notFound();

  const details = payload(document.document_payload);
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
        <Link className="btn btn-secondary" href="/profil/documents">
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
              {new Date(document.issued_at).toLocaleDateString(
                "fr-FR",
                { dateStyle: "long" },
              )}
            </strong>
          </div>
          <div>
            <span>STATUT</span>
            <strong>
              {isOrderForm ? "Commande confirmée" : "Véhicule livré"}
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
