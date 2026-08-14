import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { deleteFlashSaleV156, saveFlashSaleV156 } from "@/app/actions/v156";
import { getCatalogVehiclesV51 } from "@/lib/catalogues-v51/data";
import { getFlashSalesV156 } from "@/lib/v156/data";
import styles from "@/components/v156/v156.module.css";

function dateInput(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default async function FlashSalesDashboard() {
  const [allVehicles, sales] = await Promise.all([getCatalogVehiclesV51({ includeUnpublished: true }), getFlashSalesV156(true)]);
  const vehicles = allVehicles.filter((vehicle) => vehicle.catalog_type !== "concession");
  return (
    <DashboardShell allowedRoles={["manager", "commercial"]}>
      <DashboardHeader title="Ventes flash" description="Programmer des réductions temporaires visibles directement dans les catalogues Nostra Motors." />
      <main className={styles.page} style={{ paddingTop: 10 }}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>NOUVELLE VENTE FLASH</span>
          <h2>Programmer une offre</h2>
          <form action={saveFlashSaleV156} className={styles.formGrid}>
            <label>Véhicule<select className={styles.select} name="vehicle_id" required><option value="">Choisir…</option>{vehicles.map((v) => <option value={v.id} key={v.id}>{v.brand} {v.model} · {v.price.toLocaleString("fr-FR")} €</option>)}</select></label>
            <label>Nom de l’offre<input className={styles.input} name="title" defaultValue="Vente flash" /></label>
            <label>Prix flash<input className={styles.input} name="flash_price" type="number" min="0" required /></label>
            <label>Début<input className={styles.input} name="starts_at" type="datetime-local" required /></label>
            <label>Fin<input className={styles.input} name="ends_at" type="datetime-local" required /></label>
            <label><input type="checkbox" name="enabled" defaultChecked /> Offre active</label>
            <button className={`${styles.button} ${styles.full}`}>Créer la vente flash</button>
          </form>
        </section>
        <section className={styles.sectionTitle}><span className={styles.eyebrow}>OFFRES</span><h2>Ventes programmées</h2></section>
        <div className={styles.grid}>
          {sales.map((sale) => (
            <article className={styles.card} key={sale.id}>
              <span className={sale.activeNow ? styles.sale : styles.pill}>{sale.activeNow ? "EN DIRECT" : sale.enabled ? "PROGRAMMÉE" : "DÉSACTIVÉE"}</span>
              <h3>{sale.brand} {sale.model}</h3>
              <p>{sale.title}</p>
              <div className={styles.row}><span>Prix normal</span><strong className={styles.priceOld}>{sale.regularPrice.toLocaleString("fr-FR")} €</strong></div>
              <div className={styles.row}><span>Prix flash</span><strong className={styles.priceFlash}>{sale.flashPrice.toLocaleString("fr-FR")} €</strong></div>
              <form action={saveFlashSaleV156} className={styles.formGrid}>
                <input type="hidden" name="id" value={sale.id} /><input type="hidden" name="vehicle_id" value={sale.vehicleId} />
                <label>Titre<input className={styles.input} name="title" defaultValue={sale.title} /></label>
                <label>Prix<input className={styles.input} name="flash_price" type="number" defaultValue={sale.flashPrice} /></label>
                <label>Début<input className={styles.input} name="starts_at" type="datetime-local" defaultValue={dateInput(sale.startsAt)} /></label>
                <label>Fin<input className={styles.input} name="ends_at" type="datetime-local" defaultValue={dateInput(sale.endsAt)} /></label>
                <label><input type="checkbox" name="enabled" defaultChecked={sale.enabled} /> Active</label>
                <button className={styles.button}>Enregistrer</button>
              </form>
              <form action={deleteFlashSaleV156}><input type="hidden" name="id" value={sale.id} /><button className={styles.danger}>Supprimer</button></form>
            </article>
          ))}
        </div>
      </main>
    </DashboardShell>
  );
}
