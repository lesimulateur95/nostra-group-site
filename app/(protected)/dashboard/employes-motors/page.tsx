import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteMotorsEmployeeV164, saveMotorsEmployeeV164 } from "@/app/actions/v164";
import styles from "@/components/v164/v164.module.css";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import {
  MOTORS_JOB_ROLE_LABELS,
  MOTORS_PERMISSION_KEYS,
  MOTORS_PERMISSION_LABELS,
  getMotorsEmployeesAdminV164,
} from "@/lib/v164/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function activePermissions(value: unknown): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Set();
  return new Set(Object.entries(value as Record<string, unknown>).filter(([, enabled]) => enabled === true).map(([key]) => key));
}

export default async function MotorsEmployeesPageV164({searchParams}:{searchParams:Promise<{saved?:string;deleted?:string;error?:string}>}){
  const supabase=await createClient(); const {data}=await supabase.auth.getUser(); if(!data.user)redirect("/");
  const roles=await getUserRoleKeys(data.user); if(!roles.includes("manager"))redirect("/dashboard");
  const [overview,q]=await Promise.all([getMotorsEmployeesAdminV164(),searchParams]);
  const employees=overview.members.filter((m:any)=>m.employee);
  return <main className={styles.page}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</span><h1>Employés & permissions</h1><p>Attribue un métier Nostra Motors et masque les outils non autorisés dans le Dashboard.</p></div><Link className={styles.back} href="/dashboard">← Dashboard</Link></section>
    {q.saved&&<div className={styles.success}>Les accès Nostra Motors ont été enregistrés.</div>}{q.deleted&&<div className={styles.success}>L’employé a été retiré de Nostra Motors. Son compte citoyen reste intact.</div>}{q.error&&<div className={styles.error}>Action impossible : {q.error}</div>}
    {!overview.configured&&<div className={styles.error}>Exécute la migration Supabase V164 avant d’utiliser cette page.</div>}
    <section className={styles.stats}><article className={styles.stat}><span>Employés Motors</span><strong>{employees.length}</strong></article><article className={styles.stat}><span>Actifs</span><strong>{employees.filter((m:any)=>m.employee?.active).length}</strong></article><article className={styles.stat}><span>Permissions</span><strong>{MOTORS_PERMISSION_KEYS.length}</strong></article><article className={styles.stat}><span>Actions tracées</span><strong>{overview.audit.length}</strong></article></section>

    <section className={styles.card}><span className={styles.eyebrow}>AJOUTER UN EMPLOYÉ</span><h2>Choisir un membre du site</h2><form className={styles.form} action={saveMotorsEmployeeV164}><div className={styles.formGrid}><label>Membre<select name="user_id" required defaultValue=""><option value="">Sélectionner</option>{overview.members.map((m:any)=><option key={m.user_id} value={m.user_id}>{m.displayName}{m.employee?" · déjà configuré":""}</option>)}</select></label><label>Fonction<select name="job_role" defaultValue="vendeur">{Object.entries(MOTORS_JOB_ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><label className={styles.permission}><input type="checkbox" name="active" defaultChecked/> Accès Nostra Motors actif</label><label className={styles.permission}><input type="checkbox" name="apply_role_preset" defaultChecked/> Appliquer automatiquement les permissions recommandées de la fonction choisie</label><div className={styles.permissionGrid}>{MOTORS_PERMISSION_KEYS.map(key=><label className={styles.permission} key={key}><input type="checkbox" name={`perm_${key}`} defaultChecked={["catalogue_read","orders_manage","garage_read","crm_manage","warranty_read"].includes(key)}/>{MOTORS_PERMISSION_LABELS[key]}</label>)}</div><label>Note interne<textarea name="notes"/></label><button className={styles.button}>Ajouter / enregistrer</button></form></section>

    <section className={styles.list}>{employees.map((member:any)=>{const e=member.employee; const perms=activePermissions(e.permissions); return <article className={styles.card} key={member.user_id}><div className={styles.row}><div><span className={styles.eyebrow}>EMPLOYÉ NOSTRA MOTORS</span><h2>{member.displayName}</h2><p className={styles.muted}>{MOTORS_JOB_ROLE_LABELS[e.job_role]??e.job_role} · {e.active?"Accès actif":"Accès désactivé"}</p></div><span className={styles.pill}>{perms.size} permission(s)</span></div><form className={styles.form} action={saveMotorsEmployeeV164}><input type="hidden" name="user_id" value={member.user_id}/><div className={styles.formGrid}><label>Fonction<select name="job_role" defaultValue={e.job_role}>{Object.entries(MOTORS_JOB_ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className={styles.permission}><input type="checkbox" name="active" defaultChecked={e.active===true}/> Accès Nostra Motors actif</label></div><label className={styles.permission}><input type="checkbox" name="apply_role_preset"/> Réappliquer le profil de permissions de cette fonction</label><div className={styles.permissionGrid}>{MOTORS_PERMISSION_KEYS.map(key=><label className={styles.permission} key={key}><input type="checkbox" name={`perm_${key}`} defaultChecked={perms.has(key)}/>{MOTORS_PERMISSION_LABELS[key]}</label>)}</div><label>Note interne<textarea name="notes" defaultValue={e.notes??""}/></label><div className={styles.row}><button className={styles.button}>Enregistrer les accès</button></div></form><form action={deleteMotorsEmployeeV164}><input type="hidden" name="user_id" value={member.user_id}/><button className={styles.danger}>Retirer de Nostra Motors</button></form></article>})}{employees.length===0&&<section className={styles.card}><p className={styles.muted}>Aucun employé Nostra Motors configuré.</p></section>}</section>

    <section className={styles.card}><div className={styles.row}><div><span className={styles.eyebrow}>JOURNAL D’ACTIVITÉ</span><h2>Dernières actions V164</h2></div><span className={styles.pill}>{overview.audit.length}</span></div><div className={styles.timeline}>{overview.audit.map((row:any)=><div className={styles.timelineEntry} key={row.id}><strong>{row.title}</strong><p>{row.action_key} · {row.entity_type}{row.entity_id?` #${row.entity_id}`:""}</p><time>{new Date(row.created_at).toLocaleString("fr-FR")}</time></div>)}{overview.audit.length===0&&<p className={styles.muted}>Aucune action enregistrée pour le moment.</p>}</div></section>
  </main>
}
