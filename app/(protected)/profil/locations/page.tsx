import Link from "next/link";
import { redirect } from "next/navigation";

import { cancelRentalV155 } from "@/app/actions/v155";
import styles from "@/components/v155/v155.module.css";
import v156Styles from "@/components/v156/v156.module.css";
import { getRequestUser } from "@/lib/auth/request-context";
import { getRentalBookingsV155 } from "@/lib/v155/data";
import { getRentalInspectionsV156, type RentalInspectionV156 } from "@/lib/v156/data";

const money = (value: number) =>
  value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

function InspectionSummary({
  title,
  inspection,
}: {
  title: string;
  inspection: RentalInspectionV156 | undefined;
}) {
  if (!inspection) {
    return (
      <div className={v156Styles.card}>
        <span className={v156Styles.eyebrow}>{title}</span>
        <p>État des lieux pas encore enregistré par Nostra Motors.</p>
      </div>
    );
  }

  return (
    <div className={v156Styles.card}>
      <span className={v156Styles.eyebrow}>{title}</span>
      <div className={v156Styles.row}>
        <span>Kilométrage</span>
        <strong>{inspection.mileage == null ? "—" : `${inspection.mileage.toLocaleString("fr-FR")} km`}</strong>
      </div>
      <div className={v156Styles.row}>
        <span>Carburant</span>
        <strong>{inspection.fuelPercent == null ? "—" : `${inspection.fuelPercent} %`}</strong>
      </div>
      {inspection.exteriorCondition && <p><strong>Extérieur :</strong> {inspection.exteriorCondition}</p>}
      {inspection.interiorCondition && <p><strong>Intérieur :</strong> {inspection.interiorCondition}</p>}
      <p><strong>Dégâts :</strong> {inspection.damageNotes || "Aucun dégât constaté."}</p>
      {inspection.customerComment && <p><strong>Observation :</strong> {inspection.customerComment}</p>}
      {inspection.staffName && <small>Contrôle réalisé par {inspection.staffName}</small>}
      {inspection.photos.length > 0 && (
        <div className={v156Styles.stack}>
          {inspection.photos.map((url, index) => (
            <a href={url} target="_blank" rel="noreferrer" key={`${url}-${index}`}>Photo {index + 1} ↗</a>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function MyRentals() {
  const user = await getRequestUser();
  if (!user) redirect("/");

  const [rows, inspections] = await Promise.all([
    getRentalBookingsV155(user.id),
    getRentalInspectionsV156(),
  ]);
  const inspectionMap = new Map<string, RentalInspectionV156>(
    inspections.map((inspection: RentalInspectionV156) => [
      `${inspection.bookingId}:${inspection.inspectionType}`,
      inspection,
    ]),
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>MON ESPACE NOSTRA</span>
        <h1>Mes locations</h1>
        <p>Demandes, retrait en concession, états des lieux et suivi du retour.</p>
        <Link className={styles.buttonAlt} href="/motors/catalogue/location">
          Voir le catalogue location
        </Link>
      </section>

      {!rows.length ? (
        <div className={styles.empty}>Aucune location pour le moment.</div>
      ) : (
        <div className={styles.stack}>
          {rows.map((r: any) => {
            const departure = inspectionMap.get(`${r.id}:departure`);
            const returned = inspectionMap.get(`${r.id}:return`);
            return (
              <article className={styles.card} key={r.id}>
                <span className={styles.pill}>{String(r.status).toUpperCase()}</span>
                <h2>{r.brand} {r.model}</h2>
                <p className={styles.code}>{r.rentalNumber}</p>
                <div className={styles.row}>
                  <span>Dates</span>
                  <strong>{new Date(r.startDate).toLocaleDateString("fr-FR")} → {new Date(r.endDate).toLocaleDateString("fr-FR")}</strong>
                </div>
                <div className={styles.row}><span>Total</span><strong>{money(r.totalAmount)}</strong></div>
                <div className={styles.row}><span>Caution</span><strong>{money(r.depositAmount)}</strong></div>
                <div className={styles.row}><span>Retrait</span><strong>Concession Nostra Motors</strong></div>

                <section className={v156Styles.grid2} style={{ marginTop: 20 }}>
                  <InspectionSummary title="ÉTAT DES LIEUX · DÉPART" inspection={departure} />
                  <InspectionSummary title="ÉTAT DES LIEUX · RETOUR" inspection={returned} />
                </section>

                {r.status === "pending" && (
                  <form action={cancelRentalV155} style={{ marginTop: 18 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={styles.danger}>Annuler ma demande</button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
