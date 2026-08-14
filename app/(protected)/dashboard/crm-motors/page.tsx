import Link from "next/link";
import { addCrmNoteV153, updateCrmProfileV153 } from "@/app/actions/v153";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import styles from "@/components/v153/v153.module.css";
import v163 from "@/components/v163/v163.module.css";
import { getCrmCustomersV153, getCrmNotesV153 } from "@/lib/v153/data";
import { getCrmAfterSalesOverviewV163 } from "@/lib/v163/data";

export const dynamic="force-dynamic";
const money=(n:number)=>Number(n||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});

export default async function CrmPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const p=await searchParams;
  const customers=await getCrmCustomersV153(p.q||"");
  const selected=customers.find(c=>c.userId===p.customer)??customers[0]??null;
  const [notes,protection]=selected?await Promise.all([getCrmNotesV153(selected.userId),getCrmAfterSalesOverviewV163(selected.userId)]):[[],null];
  return <DashboardShell allowedRoles={["manager","employee","commercial"]}>
    <DashboardHeader title="CRM Nostra Motors" description="Fiche client 360° : achats, véhicules, atelier, garanties, statut commercial, tags et notes internes." />
    <div className={styles.grid2}>
      <section className={styles.card}>
        <h2>Clients</h2>
        <form className={styles.form} method="get"><label className={styles.full}>Recherche<input name="q" defaultValue={p.q||""} placeholder="Nom, e-mail, tag…"/></label><div><button className={styles.button}>Rechercher</button></div></form>
        <div className={styles.stack}>{customers.slice(0,100).map(c=><Link className={styles.result} href={`/dashboard/crm-motors?customer=${c.userId}${p.q?`&q=${encodeURIComponent(p.q)}`:""}`} key={c.userId}><span className={styles.resultIcon}>👤</span><span><strong>{c.name}</strong><small>{c.orders} commande(s) · {money(c.spent)} · {c.vehicles} véhicule(s)</small></span><span className={styles.pill}>{c.status.toUpperCase()}</span></Link>)}</div>
      </section>
      <section className={styles.stack}>{!selected?<article className={styles.card}><h2>Aucun client</h2></article>:<>
        <article className={styles.card}><div className={styles.row}><div><p className={styles.eyebrow}>FICHE CLIENT</p><h2>{selected.name}</h2><p>{selected.email||"E-mail non renseigné"}</p></div><span className={styles.pill}>{selected.status.toUpperCase()}</span></div><div className={styles.grid}><div className={styles.kpi}><span>Achats</span><strong>{selected.orders}</strong></div><div className={styles.kpi}><span>Dépensé</span><strong>{money(selected.spent)}</strong></div><div className={styles.kpi}><span>Véhicules</span><strong>{selected.vehicles}</strong></div><div className={styles.kpi}><span>Rendez-vous</span><strong>{selected.appointments}</strong></div></div><form action={updateCrmProfileV153} className={styles.form} style={{marginTop:16}}><input type="hidden" name="user_id" value={selected.userId}/><label>Statut<select name="customer_status" defaultValue={selected.status}><option value="standard">Standard</option><option value="premium">Premium</option><option value="vip">VIP</option><option value="black">Black</option></select></label><label>Contact préféré<select name="preferred_contact" defaultValue={selected.preferredContact}><option value="mail">Messagerie Nostra</option><option value="phone">Téléphone</option><option value="site">Site</option></select></label><label className={styles.full}>Tags<input name="tags" defaultValue={selected.tags.join(", ")} placeholder="collectionneur, sport, vip…"/></label><label>Commercial (UUID)<input name="assigned_commercial" placeholder="Facultatif"/></label><div className={styles.actions}><button className={styles.button} type="submit">Mettre à jour la fiche</button><Link className={styles.buttonAlt} href={`/dashboard/citoyens/${selected.userId}`}>Fiche citoyen</Link></div></form></article>
        {protection&&<article className={`${styles.card} ${v163.highlight}`}><div className={styles.row}><div><p className={styles.eyebrow}>APRÈS-VENTE & GARANTIES</p><h2>Vue Nostra 360°</h2></div><span className={styles.pill}>V163</span></div><div className={v163.kpis}><div className={v163.kpi}><span>Garanties actives</span><strong>{protection.activeWarranties}</strong></div><div className={v163.kpi}><span>Dossiers atelier</span><strong>{protection.workshopCases}</strong></div><div className={v163.kpi}><span>Dossiers atelier ouverts</span><strong>{protection.workshopOpen}</strong></div><div className={v163.kpi}><span>Garanties souscrites</span><strong>{money(protection.warrantySpent)}</strong></div></div><div className={v163.row} style={{marginTop:12}}><Link className={v163.buttonAlt} href="/dashboard/garanties">Ouvrir Nostra Care</Link><Link className={v163.buttonAlt} href="/dashboard/atelier">Voir l’atelier</Link></div></article>}
        <article className={styles.card}><h2>Notes internes</h2><form action={addCrmNoteV153} className={styles.form}><input type="hidden" name="user_id" value={selected.userId}/><label>Catégorie<select name="category"><option>suivi</option><option>vente</option><option>rendez-vous</option><option>SAV</option><option>VIP</option><option>garantie</option></select></label><label className={styles.full}>Note<textarea name="note" rows={4} required/></label><div><button className={styles.button} type="submit">Ajouter la note</button></div></form><div className={styles.timeline}>{notes.map((n:any)=><div className={styles.timelineItem} key={n.id}><span className={styles.timelineDot}/><div><strong>{n.category}</strong><p>{n.note}</p><small>{new Date(n.created_at).toLocaleString("fr-FR")}</small></div></div>)}</div></article>
      </>}</section>
    </div>
  </DashboardShell>;
}
