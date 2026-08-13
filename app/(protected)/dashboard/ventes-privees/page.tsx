import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { savePrivateSaleV155, trashContentV155 } from "@/app/actions/v155";
import { getPrivateSalesV155 } from "@/lib/v155/data";
import { getCatalogVehiclesV51 } from "@/lib/catalogues-v51/data";
import styles from "@/components/v155/v155.module.css";

function localDate(value:string|null){if(!value)return "";const d=new Date(value);if(Number.isNaN(d.getTime()))return "";const z=(n:number)=>String(n).padStart(2,"0");return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;}

export default async function PrivateSalesDashboard(){
  const [rows,vehicles]=await Promise.all([getPrivateSalesV155(undefined,true),getCatalogVehiclesV51({includeUnpublished:true})]);
  return <DashboardShell><DashboardHeader title="Ventes privées / accès VIP" description="Créer des offres réservées aux citoyens qui atteignent le niveau de fidélité demandé. Les seuils peuvent être modifiés à tout moment."/><main className={styles.page} style={{paddingTop:10}}>
    <section className={styles.card}><h2>Créer une vente privée</h2><form action={savePrivateSaleV155} className={styles.formGrid}>
      <label>Véhicule<select className={styles.select} name="vehicle_id" required><option value="">Choisir…</option>{vehicles.map(v=><option value={v.id} key={v.id}>{v.brand} {v.model}</option>)}</select></label>
      <label>Points minimum<input className={styles.input} type="number" name="min_loyalty_points" defaultValue={500}/></label>
      <label className={styles.full}>Titre<input className={styles.input} name="title" required/></label>
      <label className={styles.full}>Description<textarea className={styles.textarea} name="description"/></label>
      <label>Début<input className={styles.input} type="datetime-local" name="starts_at"/></label><label>Fin<input className={styles.input} type="datetime-local" name="ends_at"/></label>
      <label>Stock réservé<input className={styles.input} type="number" name="stock_limit"/></label><label><input type="checkbox" name="enabled" defaultChecked/> Active</label>
      <button className={`${styles.button} ${styles.full}`}>Créer l’offre VIP</button>
    </form></section>
    <section className={styles.sectionTitle}><h2>Offres configurées</h2><p>Chaque offre peut être ajustée immédiatement sans la recréer.</p></section>
    <div className={styles.stack}>{rows.map((r:any)=><article className={styles.card} key={r.id}>
      <div className={styles.row}><div><strong>{r.title}</strong><p>{r.brand} {r.model} · {r.minPoints} pts</p></div><span className={styles.pill}>{r.enabled?"ACTIVE":"COUPÉE"}</span></div>
      <form action={savePrivateSaleV155} className={styles.formGrid}>
        <input type="hidden" name="id" value={r.id}/><input type="hidden" name="vehicle_id" value={r.vehicleId}/>
        <label>Points minimum<input className={styles.input} type="number" name="min_loyalty_points" defaultValue={r.minPoints}/></label>
        <label>Stock réservé<input className={styles.input} type="number" name="stock_limit" defaultValue={r.stockLimit??""}/></label>
        <label className={styles.full}>Titre<input className={styles.input} name="title" defaultValue={r.title} required/></label>
        <label className={styles.full}>Description<textarea className={styles.textarea} name="description" defaultValue={r.description}/></label>
        <label>Début<input className={styles.input} type="datetime-local" name="starts_at" defaultValue={localDate(r.startsAt)}/></label><label>Fin<input className={styles.input} type="datetime-local" name="ends_at" defaultValue={localDate(r.endsAt)}/></label>
        <label><input type="checkbox" name="enabled" defaultChecked={r.enabled}/> Offre active</label>
        <button className={styles.button}>Enregistrer les modifications</button>
      </form>
      <form action={trashContentV155} style={{marginTop:12}}><input type="hidden" name="entity_type" value="nostra_private_sales_v155"/><input type="hidden" name="id" value={r.id}/><input type="hidden" name="title" value={r.title}/><button className={styles.danger}>Mettre à la corbeille</button></form>
    </article>)}</div>
  </main></DashboardShell>;
}
