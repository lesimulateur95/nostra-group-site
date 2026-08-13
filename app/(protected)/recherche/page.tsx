import { redirect } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/site/topbar";
import { createClient } from "@/lib/supabase/server";
import { searchCitizenV153 } from "@/lib/v153/data";
import styles from "@/components/v153/v153.module.css";
export const dynamic="force-dynamic";
const icon:Record<string,string>={Véhicule:"🚘",Événement:"📅",Document:"📄",Commande:"📦",Écurie:"🏎️",Billetterie:"🎟️"};
export default async function CitizenSearch({searchParams}:{searchParams:Promise<{q?:string}>}){const supabase=await createClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect("/");const p=await searchParams,q=p.q||"";const results=await searchCitizenV153(q,data.user.id);return <><Topbar/><main className={styles.page}><header className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>RECHERCHE NOSTRA</p><h1>Tout retrouver</h1><p>Recherche un véhicule, un événement, une commande, un document, une écurie ou un billet.</p></div><Link className={styles.back} href="/accueil">← Accueil</Link></header><div className={styles.searchBar}><form><input autoFocus className={styles.searchInput} name="q" defaultValue={q} placeholder="Que cherches-tu ?"/><button className={styles.button}>Rechercher</button></form></div><section className={styles.stack}>{results.map((r,i)=><Link href={r.href} className={styles.result} key={`${r.kind}-${i}`}><span className={styles.resultIcon}>{icon[r.kind]||"⌕"}</span><span><strong>{r.title}</strong><small>{r.kind} · {r.subtitle}</small></span>{r.badge&&<span className={styles.pill}>{r.badge}</span>}</Link>)}{q.length>=2&&results.length===0&&<article className={styles.card}>Aucun résultat.</article>}</section></main></>}
