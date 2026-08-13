import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyVehicleContractsV153 } from "@/lib/v153/data";
import styles from "@/components/v153/v153.module.css";

export const dynamic = "force-dynamic";
const money = (n:number)=>n.toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
export default async function ContractsPage(){
  const supabase=await createClient(); const {data}=await supabase.auth.getUser(); if(!data.user) redirect("/");
  const contracts=await getMyVehicleContractsV153(data.user.id);
  return <main className={styles.page}><header className={styles.hero}><p className={styles.eyebrow}>NOSTRA MOTORS · DOCUMENTS OFFICIELS</p><h1>Mes contrats de vente</h1><p>Les contrats définitifs apparaissent automatiquement après validation du paiement et signature du bon de commande.</p><Link className={styles.buttonAlt} href="/profil">← Retour au profil</Link></header><section className={styles.stack}>{contracts.length===0?<article className={styles.card}><h2>Aucun contrat définitif</h2><p>Lorsqu’une commande payée et signée sera finalisée, son contrat apparaîtra ici automatiquement.</p></article>:contracts.map(c=><article className={styles.card} key={c.id}><div className={styles.row}><div><span className={styles.eyebrow}>CONTRAT OFFICIEL</span><h2>{c.contractNumber}</h2><p>Commande #{c.orderId} · Signé le {new Date(c.signedAt).toLocaleDateString("fr-FR")}</p></div><div><strong>{money(c.amount)}</strong><br/><span className={styles.pill}>{c.status.toUpperCase()}</span></div></div><div className={styles.actions}><Link className={styles.button} href={`/profil/contrats/${c.id}`}>Ouvrir le contrat</Link><span className={styles.pill}>Vérification {c.verificationCode}</span></div></article>)}</section></main>;
}
