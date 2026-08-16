/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  garageStatusLabel,
  getMyGarageVehicle,
} from "@/lib/garage/data";
import { createClient } from "@/lib/supabase/server";
import { getMyGarageWarrantyContractsV163 } from "@/lib/v163/data";
import { cancelVehicleTransferV164, createVehicleTransferV164 } from "@/app/actions/v164";
import { getCitizenDirectoryV164, getVehicleMaintenanceV164, getVehicleTransfersV164, refreshMyVehicleNotificationsV164 } from "@/lib/v164/data";
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

  await refreshMyVehicleNotificationsV164();
  const [result, warrantyResult] = await Promise.all([
    getMyGarageVehicle(data.user.id, id),
    getMyGarageWarrantyContractsV163(data.user.id, id),
  ]);
  if (!result.configured) redirect("/profil/garage");
  if (!result.vehicle) redirect("/profil/garage");

  const vehicle = result.vehicle;
  const title = vehicleTitle(vehicle.brand, vehicle.model, vehicle.vehicleName);
  const encodedVehicle = encodeURIComponent(title);
  const activeWarranty = warrantyResult.contracts.find(
    (row: any) =>
      row.status === "active" && new Date(String(row.ends_at)).getTime() > Date.now(),
  ) ?? null;
  const pendingWarranty = warrantyResult.contracts.find(
    (row: any) => row.status === "pending_payment",
  ) ?? null;
  const displayedWarranty = activeWarranty ?? pendingWarranty;
  const [maintenanceResult, transferResult, citizenDirectory] = await Promise.all([
    getVehicleMaintenanceV164(vehicle.id),
    getVehicleTransfersV164(data.user.id, vehicle.id),
    getCitizenDirectoryV164(),
  ]);
  const pendingTransfer = transferResult.requests.find((row: any) => row.status === "pending" && row.seller_user_id === data.user.id) ?? null;
  const warrantyDaysRemaining = activeWarranty
    ? Math.max(0, Math.ceil((new Date(String(activeWarranty.ends_at)).getTime() - Date.now()) / 86400000))
    : null;

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
            <div>
              <dt>VIN Nostra</dt>
              <dd>{vehicle.nostraVin || "En cours de génération"}</dd>
            </div>
            <div>
              <dt>Kilométrage enregistré</dt>
              <dd>{vehicle.currentMileage.toLocaleString("fr-FR")} km</dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <Link
              className={styles.primaryAction}
              href={`/motors/atelier?vehicle=${vehicle.id}`}
            >
              Atelier / entretien
            </Link>
            <Link href={`/profil/garanties?vehicle=${vehicle.id}`}>
              Garantie Nostra Care
            </Link>
            <Link
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

      <section
        className={`${styles.warrantyPanel} ${
          activeWarranty
            ? styles.warrantyActive
            : pendingWarranty
              ? styles.warrantyPending
              : ""
        }`}
      >
        <div className={styles.warrantyHeading}>
          <div>
            <p className={styles.eyebrow}>CONTRAT NOSTRA CARE</p>
            <h2>{displayedWarranty ? displayedWarranty.plan_name : "Aucune protection active"}</h2>
          </div>
          <span className={styles.warrantyState}>
            {activeWarranty ? `ACTIF · ${warrantyDaysRemaining} J` : pendingWarranty ? "DANS LE PANIER" : "NON SOUSCRIT"}
          </span>
        </div>

        {displayedWarranty ? (
          <>
            <dl className={styles.warrantyGrid}>
              <div>
                <dt>Contrat</dt>
                <dd>{displayedWarranty.contract_number}</dd>
              </div>
              <div>
                <dt>Montant</dt>
                <dd>{money(Number(displayedWarranty.amount ?? 0))}</dd>
              </div>
              <div>
                <dt>Calcul</dt>
                <dd>{Number(displayedWarranty.rate_percent ?? 0)} % de {money(Number(displayedWarranty.reference_vehicle_price ?? vehicle.purchasePrice))}</dd>
              </div>
              <div>
                <dt>Durée</dt>
                <dd>{Number(displayedWarranty.duration_days ?? 0)} jours</dd>
              </div>
              <div>
                <dt>Début</dt>
                <dd>{activeWarranty ? date(displayedWarranty.starts_at) : "Après paiement"}</dd>
              </div>
              <div>
                <dt>Fin</dt>
                <dd>{activeWarranty ? date(displayedWarranty.ends_at) : "Calculée au paiement"}</dd>
              </div>
              {activeWarranty && <div>
                <dt>Temps restant</dt>
                <dd>{warrantyDaysRemaining} jour{warrantyDaysRemaining === 1 ? "" : "s"}</dd>
              </div>}
            </dl>
            <div className={styles.warrantyActions}>
              <Link href={`/profil/garanties?vehicle=${vehicle.id}`}>
                Voir les détails du contrat
              </Link>
              {pendingWarranty && <Link href="/profil">Ouvrir le panier</Link>}
            </div>
          </>
        ) : (
          <div className={styles.warrantyEmpty}>
            <p>
              Aucun contrat Nostra Care n’est actuellement lié à ce véhicule. Le prix
              sera calculé automatiquement à partir de son prix d’achat de {money(vehicle.purchasePrice)}.
            </p>
            <Link href={`/profil/garanties?vehicle=${vehicle.id}`}>
              Choisir une garantie pour ce véhicule
            </Link>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>CARNET D’ENTRETIEN NOSTRA</p>
            <h2>Suivi officiel réalisé par les équipes Nostra Motors</h2>
          </div>
          <strong>{maintenanceResult.records.length}</strong>
        </div>
        {maintenanceResult.records.length === 0 ? (
          <p className={styles.emptyText}>Aucun entretien officiel enregistré pour ce véhicule.</p>
        ) : (
          <ol className={styles.timeline}>
            {maintenanceResult.records.map((record) => (
              <li key={record.id}>
                <span className={styles.timelineDot} aria-hidden="true" />
                <div>
                  <strong>{record.title}</strong>
                  <p>{new Date(record.serviceDate).toLocaleDateString("fr-FR")}{record.mileage != null ? ` · ${record.mileage.toLocaleString("fr-FR")} km` : ""}{record.warrantyCovered ? " · Pris en charge Nostra Care" : ""}</p>
                  {record.workDone && <p><b>Travaux :</b> {record.workDone}</p>}
                  {record.partsReplaced && <p><b>Pièces :</b> {record.partsReplaced}</p>}
                  {record.staffComment && <p><b>Commentaire Nostra :</b> {record.staffComment}</p>}
                  {(record.nextServiceDate || record.nextServiceMileage) && <p><b>Prochain entretien :</b> {record.nextServiceDate ? new Date(record.nextServiceDate).toLocaleDateString("fr-FR") : ""}{record.nextServiceMileage ? ` · ${record.nextServiceMileage.toLocaleString("fr-FR")} km` : ""}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>PROPRIÉTÉ</p>
            <h2>Transfert / revente du véhicule</h2>
          </div>
          <strong>{transferResult.requests.length}</strong>
        </div>
        {pendingTransfer ? (
          <div className={styles.warrantyEmpty}>
            <p>Une demande <b>{pendingTransfer.transfer_number}</b> est en attente de validation par Nostra Motors.</p>
            <form action={cancelVehicleTransferV164}>
              <input type="hidden" name="id" value={pendingTransfer.id} />
              <input type="hidden" name="customer_vehicle_id" value={vehicle.id} />
              <button type="submit">Annuler ma demande</button>
            </form>
          </div>
        ) : (
          <form action={createVehicleTransferV164} className={styles.transferFormV164}>
            <input type="hidden" name="customer_vehicle_id" value={vehicle.id} />
            <label>Type
              <select name="transfer_type" defaultValue="sale"><option value="sale">Revente</option><option value="gift">Cession / don</option></select>
            </label>
            <label>Nouveau propriétaire
              <select name="target_user_id" required defaultValue=""><option value="">Sélectionner un citoyen</option>{citizenDirectory.filter((row) => row.userId !== data.user.id).map((row) => <option value={row.userId} key={row.userId}>{row.name}</option>)}</select>
            </label>
            <label>Prix de revente (€)
              <input type="number" min="0" step="1" name="sale_price" defaultValue="0" />
            </label>
            <label>Note pour Nostra Motors
              <textarea name="seller_note" rows={3} placeholder="Informations utiles pour la validation." />
            </label>
            <button type="submit">Envoyer la demande de transfert</button>
          </form>
        )}
        {transferResult.requests.length > 0 && <div className={styles.transferHistoryV164}>
          {transferResult.requests.slice(0,5).map((row:any) => <div key={row.id}><strong>{row.transfer_number}</strong><span>{String(row.status).toUpperCase()} · {new Date(String(row.created_at)).toLocaleDateString("fr-FR")}</span></div>)}
        </div>}
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
