import Link from "next/link";
import { redirect } from "next/navigation";

import { processVehicleTransferV164, saveMotorsV164Settings } from "@/app/actions/v164";
import styles from "@/components/v164/v164.module.css";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { getMotorsEmployeeAccessV164, getTransferAdminV164 } from "@/lib/v164/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const money=(v:unknown)=>Number(v??0).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const date=(v:unknown)=>v?new Date(String(v)).toLocaleString("fr-FR"):"—";
const vehicleLabel=(row:any)=>row?.vehicle?`${row.vehicle.brand??""} ${row.vehicle.model??""}`.trim()||row.vehicle.vehicle_name||`Véhicule #${row.customer_vehicle_id}`:`Véhicule #${row.customer_vehicle_id}`;

export default async function VehicleTransfersDashboardV164({searchParams}:{searchParams:Promise<{processed?:string;settings_saved?:string;error?:string}>}){
  const supabase=await createClient(); const {data}=await supabase.auth.getUser(); if(!data.user)redirect("/");
  const roles=await getUserRoleKeys(data.user); const manager=roles.includes("manager"); const access=await getMotorsEmployeeAccessV164(data.user.id,manager);
  if(!manager&&!access.permissions.has("transfer_manage"))redirect("/dashboard");
  const [overview,q]=await Promise.all([getTransferAdminV164(),searchParams]);
  const pending=overview.requests.filter((r:any)=>r.status==="pending").length;
  return <main className={styles.page}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>NOSTRA MOTORS · PROPRIÉTÉ</span><h1>Transferts & reventes</h1><p>Valide les changements de propriétaire sans perdre l’historique du véhicule.</p></div><Link className={styles.back} href="/dashboard">← Dashboard</Link></section>
    {q.processed&&<div className={styles.success}>La demande a été traitée et le garage du véhicule a été mis à jour.</div>}{q.settings_saved&&<div className={styles.success}>La règle Nostra Care a été enregistrée.</div>}{q.error&&<div className={styles.error}>Action impossible : {decodeURIComponent(q.error)}</div>}
    <section className={styles.stats}><article className={styles.stat}><span>Demandes</span><strong>{overview.requests.length}</strong></article><article className={styles.stat}><span>À valider</span><strong>{pending}</strong></article><article className={styles.stat}><span>Validées</span><strong>{overview.requests.filter((r:any)=>r.status==="approved").length}</strong></article><article className={styles.stat}><span>Refusées</span><strong>{overview.requests.filter((r:any)=>r.status==="rejected").length}</strong></article></section>
    {manager&&<section className={styles.card}><span className={styles.eyebrow}>RÈGLE NOSTRA CARE</span><h2>Que devient une garantie active lors d’un transfert ?</h2><form className={styles.form} action={saveMotorsV164Settings}><div className={styles.formGrid}><label>Politique<select name="warranty_transfer_policy" defaultValue={overview.policy}><option value="transfer">Transférer automatiquement la garantie au nouveau propriétaire</option><option value="cancel">Annuler la garantie au changement de propriétaire</option><option value="manual">Décision manuelle au moment de valider</option></select></label></div><button className={styles.button}>Enregistrer la règle</button></form></section>}
    <section className={styles.list}>{overview.requests.length===0&&<section className={styles.card}><p className={styles.muted}>Aucune demande de transfert.</p></section>}{overview.requests.map((row:any)=><article className={styles.card} key={row.id}><div className={styles.row}><div><span className={styles.eyebrow}>{row.transfer_number}</span><h2>{vehicleLabel(row)}</h2><p className={styles.muted}>{row.sellerName} → {row.targetName} · {row.transfer_type} · {date(row.created_at)}</p></div><span className={styles.pill}>{String(row.status).toUpperCase()}</span></div><div className={styles.grid3}><div className={styles.item}><strong>Prix de revente</strong><p>{money(row.sale_price)}</p></div><div className={styles.item}><strong>VIN</strong><p>{row.vehicle?.nostra_vin??"—"}</p></div><div className={styles.item}><strong>Nostra Care</strong><p>{row.warranty_action??(overview.policy==="manual"?"À décider":overview.policy)}</p></div></div>{row.seller_note&&<p><b>Note vendeur :</b> {row.seller_note}</p>}{row.status==="pending"&&<form className={styles.form} action={processVehicleTransferV164}><input type="hidden" name="id" value={row.id}/><label>Décision Nostra Care<select name="warranty_action" defaultValue={overview.policy==="cancel"?"cancel":"transfer"}><option value="transfer">Transférer la garantie active</option><option value="cancel">Annuler la garantie active</option></select></label><label>Note Direction<textarea name="staff_note"/></label><div className={styles.row}><button className={styles.button} name="decision" value="approved">Valider le transfert</button><button className={styles.danger} name="decision" value="rejected">Refuser</button></div></form>}{row.status!=="pending"&&row.staff_note&&<p><b>Note Direction :</b> {row.staff_note}</p>}</article>)}</section>
  </main>
}
