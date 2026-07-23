/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  garageStatusLabel,
  getMyGarageVehicle,
} from "@/lib/garage/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function date(value: string | null): string {
  if (!value) return "Non renseignée";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function vehicleTitle(
  brand: string | null,
  model: string | null,
  fallback: string,
): string {
  return `${brand ?? ""} ${model ?? ""}`.trim() || fallback;
}

export default async function ProfileGarageVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const resolvedParams = await params;
  const id = Number.parseInt(resolvedParams.id, 10);
  if (!Number.isFinite(id) || id <= 0) redirect("/profil/garage");

  const result = await getMyGarageVehicle(data.user.id, id);
  if (!result.configured) redirect("/profil/garage");
  if (!result.vehicle) redirect("/profil/garage");

  const vehicle = result.vehicle;
  const title = vehicleTitle(vehicle.brand, vehicle.model, vehicle.vehicleName);
  const encodedVehicle = encodeURIComponent(title);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/profil/garage">
        ← Retour à mon garage
      </Link>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>FICHE VÉHICULE NOSTRA MOTORS</p>
          <h1>{title}</h1>
          <p>
            Commande {vehicle.orderNumber} · {garageStatusLabel(vehicle.garageStatus)}
          </p>
        </div>
        <span className={`${styles.status} ${styles[vehicle.garageStatus]}`}>
          {garageStatusLabel(vehicle.garageStatus)}
        </span>
      </section>

      {result.error && <div className={styles.warning}>{result.error}</div>}

      <section className={styles.overview}>
        <div className={styles.media}>
          {vehicle.imageUrl ? (
            <img src={vehicle.imageUrl} alt={title} />
          ) : (
            <span>NM</span>
          )}
        </div>

        <div className={styles.information}>
          <p className={styles.eyebrow}>INFORMATIONS</p>
          <h2>Dossier du véhicule</h2>

          <dl className={styles.infoGrid}>
            <div>
              <dt>Commande</dt>
              <dd>{vehicle.orderNumber}</dd>
            </div>
            <div>
              <dt>Prix d’achat</dt>
              <dd>{money(vehicle.purchasePrice)}</dd>
            </div>
            <div>
              <dt>Date d’entrée</dt>
              <dd>{date(vehicle.createdAt)}</dd>
            </div>
            <div>
              <dt>Date de livraison</dt>
              <dd>{date(vehicle.acquiredAt)}</dd>
            </div>
            <div>
              <dt>Mode de livraison</dt>
              <dd>{vehicle.deliveryMode || "Showroom Nostra Motors"}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>{vehicle.deliveryAddress || "Retrait au showroom"}</dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <Link
              className={styles.primaryAction}
              href={`/motors/rendez-vous?vehicule=${encodedVehicle}`}
            >
              Prendre un rendez-vous
            </Link>
            <Link href={`/motors/sav?vehicule=${encodedVehicle}`}>
              Ouvrir un SAV
            </Link>
            <Link href="/profil/commandes">Voir la commande</Link>
          </div>
        </div>
      </section>

      <section className={styles.columns}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>HISTORIQUE</p>
              <h2>Suivi du véhicule</h2>
            </div>
            <strong>{result.history.length}</strong>
          </div>

          {result.history.length === 0 ? (
            <p className={styles.emptyText}>Aucun événement enregistré.</p>
          ) : (
            <ol className={styles.timeline}>
              {result.history.map((entry) => (
                <li key={entry.id}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div>
                    <strong>{entry.title}</strong>
                    {entry.details && <p>{entry.details}</p>}
                    <time>{date(entry.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>DOCUMENTS</p>
              <h2>Documents associés</h2>
            </div>
            <strong>{result.documents.length}</strong>
          </div>

          {result.documents.length === 0 ? (
            <p className={styles.emptyText}>
              Les documents apparaîtront après la confirmation ou la livraison.
            </p>
          ) : (
            <div className={styles.documentList}>
              {result.documents.map((document) => (
                <Link
                  href={`/profil/documents/${document.id}`}
                  key={document.id}
                >
                  <span>
                    <strong>
                      {document.documentTitle || document.invoiceNumber}
                    </strong>
                    <small>
                      {document.invoiceNumber} · {date(document.issuedAt)}
                    </small>
                  </span>
                  <b>Ouvrir →</b>
                </Link>
              ))}
            </div>
          )}

          <Link className={styles.allDocuments} href="/profil/documents">
            Voir tous mes documents
          </Link>
        </article>
      </section>
    </main>
  );
}
