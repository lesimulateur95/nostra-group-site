import Link from "next/link";
import { notFound } from "next/navigation";
import { createRentalRequestV155, joinVehicleWaitlistV155 } from "@/app/actions/v155";
import { getRentalVehiclesV155 } from "@/lib/v155/data";
import styles from "@/components/v155/v155.module.css";

const money=(v:number)=>v.toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
export default async function RentalVehiclePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const [{id},q]=await Promise.all([params,searchParams]); const vehicleId=Number(id); const vehicles=await getRentalVehiclesV155(true); const v=vehicles.find(x=>x.vehicleId===vehicleId); if(!v)notFound();
  return <main className={styles.page}>
    <section className={styles.hero}><span className={styles.eyebrow}>NOSTRA MOTORS · LOCATION</span><h1>{v.brand} {v.model}</h1><p>Choisis tes dates. Le véhicule est retiré et restitué uniquement à la concession Nostra Motors.</p><Link className={styles.buttonAlt} href="/motors/catalogue/location">← Catalogue location</Link></section>
    {q.error&&<div className={styles.card}><strong className={styles.bad}>Location impossible : {decodeURIComponent(q.error)}</strong></div>}
    <div className={styles.split}>
      <article className={styles.card}>{v.imageUrl?<div className={styles.media}><img src={v.imageUrl} alt={`${v.brand} ${v.model}`}/></div>:null}<h2>{v.brand} {v.model}</h2><div className={styles.grid2}><div className={styles.kpi}><span>Tarif / jour</span><strong>{money(v.dailyRate)}</strong></div><div className={styles.kpi}><span>Caution</span><strong>{money(v.depositAmount)}</strong></div><div className={styles.kpi}><span>Kilométrage inclus</span><strong>{v.mileageIncludedPerDay} km/j</strong></div><div className={styles.kpi}><span>Disponibilité stock</span><strong>{v.stock}</strong></div></div></article>
      <article className={styles.card}><h2>Louer ce véhicule</h2><form action={createRentalRequestV155} className={styles.formGrid}><input type="hidden" name="vehicle_id" value={v.vehicleId}/><label>Date de départ<input className={styles.input} type="date" name="start_date" required/></label><label>Date de retour<input className={styles.input} type="date" name="end_date" required/></label><div className={styles.full}><p className={styles.small}>Durée autorisée : {v.minDays} à {v.maxDays} jours · Retrait concession obligatoire.</p></div><button className={`${styles.button} ${styles.full}`} type="submit">Louer / envoyer la demande</button></form>{v.stock<=0&&<form action={joinVehicleWaitlistV155} className={styles.actions}><input type="hidden" name="vehicle_id" value={v.vehicleId}/><input type="hidden" name="reason" value="rental"/><button className={styles.buttonAlt}>Me mettre sur la liste d’attente</button></form>}</article>
    </div>
  </main>;
}
