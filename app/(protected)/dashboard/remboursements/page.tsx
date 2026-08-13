import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { createRefundV155, processRefundV155 } from "@/app/actions/v155";
import { getRefundsV155 } from "@/lib/v155/data";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/v155/v155.module.css";

const money = (v:number) => `${Math.trunc(v).toLocaleString("fr-FR")} $RP`;
const statusLabel:Record<string,string>={pending:"EN ATTENTE",approved:"VALIDÉ · À CRÉDITER",paid:"REMBOURSÉ",rejected:"REFUSÉ",cancelled:"ANNULÉ"};

export default async function RefundDashboard(){
  const supabase=await createClient();
  const [rows,profiles]=await Promise.all([
    getRefundsV155(),
    (supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name").order("rp_last_name")
  ]);
  return <DashboardShell><DashboardHeader title="Remboursements Direction" description="Créer un remboursement partiel ou total, le valider, puis exécuter le crédit avec une trace complète dans l’audit."/><main className={styles.page} style={{paddingTop:10}}>
    <section className={styles.card}><h2>Nouveau remboursement</h2><form action={createRefundV155} className={styles.formGrid}>
      <label>Citoyen<select className={styles.select} name="user_id" required><option value="">Choisir…</option>{(profiles.data??[]).map((p:any)=><option key={p.user_id} value={p.user_id}>{`${p.rp_first_name??""} ${p.rp_last_name??""}`.trim()||p.discord_name||p.user_id}</option>)}</select></label>
      <label>Type<select className={styles.select} name="refund_kind"><option value="partial">Remboursement partiel</option><option value="total">Remboursement total</option></select></label>
      <label>Montant $RP<input className={styles.input} type="number" name="amount" min="1" required/></label>
      <label>Source<select className={styles.select} name="source_type"><option value="order">Commande Motors</option><option value="rental">Location</option><option value="ticket">Billetterie</option><option value="casino">Nostra Cercle</option><option value="manual">Autre / manuel</option></select></label>
      <label>Référence source<input className={styles.input} name="source_id" placeholder="N° commande / location / billet…"/></label>
      <label className={styles.full}>Motif<textarea className={styles.textarea} name="reason" required placeholder="Motif obligatoire du remboursement…"/></label>
      <button className={`${styles.button} ${styles.full}`}>Créer la demande à valider</button>
    </form></section>
    <section className={styles.sectionTitle}><h2>Historique & validation</h2></section>
    <div className={styles.stack}>{rows.map((r:any)=><article className={styles.card} key={r.id}>
      <div className={styles.row}><div><strong>{r.name}</strong><p>{r.refund_kind==="total"?"Remboursement total":"Remboursement partiel"} · {r.source_type} {r.source_id?`· ${r.source_id}`:""}</p></div><div><strong className={styles.highlight}>{money(r.amount)}</strong><br/><span className={styles.pill}>{statusLabel[r.status]??r.status}</span></div></div>
      <p>{r.reason}</p>
      {r.status==="pending"&&<div className={styles.actions}><form action={processRefundV155}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="decision" value="approve"/><button className={styles.button}>Valider la demande</button></form><form action={processRefundV155}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="decision" value="reject"/><button className={styles.danger}>Refuser</button></form></div>}
      {r.status==="approved"&&<form action={processRefundV155}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="decision" value="pay"/><button className={styles.button}>Créditer le remboursement maintenant</button></form>}
    </article>)}</div>
  </main></DashboardShell>;
}
