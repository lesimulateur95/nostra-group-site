import Link from "next/link";
import { redirect } from "next/navigation";

import { createWorkshopCaseV162, decideWorkshopQuoteV162 } from "@/app/actions/v162";
import styles from "@/components/v162/v162.module.css";
import { getMyGarageVehicles } from "@/lib/garage/data";
import { getMyWorkshopCasesV162, getWorkshopQuoteLinesV162 } from "@/lib/v162/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
const money=(v:number)=>v.toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const labels:Record<string,string>={requested:"Demande reçue",accepted:"RDV accepté",vehicle_received:"Véhicule réceptionné",diagnosis:"Diagnostic",quote_waiting:"Devis en attente",quote_accepted:"Devis accepté",quote_refused:"Devis refusé",in_progress:"Intervention en cours",final_check:"Contrôle final",ready:"Prêt",returned:"Restitué",cancelled:"Annulé"};

export default async function WorkshopCitizenPage({searchParams}:{searchParams:Promise<{created?:string;decision?:string;error?:string;vehicle?:string}>}){
 const s=await createClient();const {data}=await s.auth.getUser();if(!data.user)redirect("/");
 const [garage,cases,q]=await Promise.all([getMyGarageVehicles(data.user.id),getMyWorkshopCasesV162(data.user.id),searchParams]);
 const lines=await getWorkshopQuoteLinesV162(cases.map(c=>c.id));
 return <main className={styles.page}>
  <section className={styles.hero}><span className={styles.eyebrow}>NOSTRA MOTORS · ATELIER</span><h1>Service après-vente & Atelier</h1><p>Planifie l’entretien d’un véhicule de ton garage, suis le diagnostic et valide directement les devis transmis par Nostra Motors.</p><div className={styles.actions}><Link className={styles.buttonAlt} href="/motors/sav">SAV général</Link><Link className={styles.buttonAlt} href="/profil/garage">Mon garage</Link></div></section>
  {q.created&&<div className={styles.success}>Demande atelier envoyée.</div>}{q.decision&&<div className={styles.success}>Ta réponse au devis a été enregistrée.</div>}{q.error&&<div className={styles.error}>Action impossible. Vérifie le dossier ou l’activation SQL V162.</div>}
  <div className={styles.grid2}>
   <section className={styles.panel}><span className={styles.eyebrow}>NOUVEAU RENDEZ-VOUS</span><h2>Confier un véhicule à l’atelier</h2>
    <form className={styles.form} action={createWorkshopCaseV162}>
     <label>Véhicule<select name="customer_vehicle_id" required defaultValue={q.vehicle??""}><option value="">Sélectionner dans mon garage</option>{garage.vehicles.map(v=><option key={v.id} value={v.id}>{`${v.brand??""} ${v.model??""}`.trim()||v.vehicleName} · {v.orderNumber}</option>)}</select></label>
     <div className={styles.formGrid}><label>Intervention<select name="service_type" defaultValue="maintenance"><option value="maintenance">Entretien</option><option value="mechanical">Mécanique</option><option value="bodywork">Carrosserie</option><option value="diagnostic">Diagnostic</option><option value="tyres">Pneumatiques</option><option value="detailing">Préparation esthétique</option><option value="other">Autre</option></select></label><label>Kilométrage<input type="number" name="mileage" min="0" placeholder="Ex. 24500"/></label></div>
     <div className={styles.formGrid}><label>Date souhaitée<input type="date" name="requested_date"/></label><label>Créneau souhaité<input name="requested_slot" placeholder="Ex. 18h00 - 19h00"/></label></div>
     <label>Demande<textarea name="description" required minLength={10} placeholder="Décris l’entretien, la panne ou la demande à effectuer."/></label><button className={styles.button}>Envoyer la demande atelier</button>
    </form>
   </section>
   <section className={styles.panel}><span className={styles.eyebrow}>MES DOSSIERS</span><h2>{cases.length} intervention(s)</h2><div className={styles.list}>{cases.length===0&&<div className={styles.empty}>Aucun passage atelier enregistré.</div>}{cases.map(c=>{const quote=lines.get(c.id)??[];return <article className={styles.card} key={c.id}><div className={styles.sectionTitle}><div><span className={styles.pill}>{c.caseNumber}</span><h3>{c.vehicleLabel}</h3></div><strong>{labels[c.status]??c.status}</strong></div><p className={styles.muted}>{c.description}</p>{c.appointmentAt&&<p>RDV : <strong>{new Date(c.appointmentAt).toLocaleString("fr-FR")}</strong></p>}{c.diagnosis&&<div className={styles.notice}><strong>Diagnostic Nostra</strong><br/>{c.diagnosis}</div>}{quote.length>0&&<div><h3>Devis · {money(c.quoteTotal)}</h3><div className={styles.quoteLines}>{quote.map(l=><div className={styles.quoteLine} key={l.id}><span>{l.label}</span><span>x{l.quantity}</span><strong>{money(l.quantity*l.unitPrice)}</strong></div>)}</div>{c.quoteStatus==="sent"&&<div className={styles.actions}><form action={decideWorkshopQuoteV162}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="decision" value="accept"/><button className={styles.button}>Accepter le devis</button></form><form action={decideWorkshopQuoteV162}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="decision" value="refuse"/><button className={styles.danger}>Refuser</button></form></div>}</div>}</article>})}</div></section>
  </div>
 </main>
}
