import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDirectionOverviewV153, getMaintenancePolesV153 } from "@/lib/v153/data";
import styles from "@/components/v153/v153.module.css";

export const dynamic = "force-dynamic";
const euro = (v:number)=>v.toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
export default async function DirectionGeneralePage(){
  const [kpi,maintenance]=await Promise.all([getDirectionOverviewV153(),getMaintenancePolesV153()]);
  return <DashboardShell>
    <DashboardHeader title="Direction générale" description="Vue consolidée de Nostra Motors, Nostra Circuit, Nostra Cercle et des services du groupe." />
    <section className={styles.grid}>
      <article className={styles.kpi}><span>Citoyens</span><strong>{kpi.citizens}</strong></article>
      <article className={styles.kpi}><span>CA Nostra Motors</span><strong>{euro(kpi.motorsRevenue)}</strong></article>
      <article className={styles.kpi}><span>Commandes actives</span><strong>{kpi.activeOrders}</strong></article>
      <article className={styles.kpi}><span>Rendez-vous à traiter</span><strong>{kpi.pendingAppointments}</strong></article>
      <article className={styles.kpi}><span>Billets vendus</span><strong>{kpi.ticketsSold}</strong><small>{euro(kpi.ticketRevenue)} encaissés</small></article>
      <article className={styles.kpi}><span>Remises accordées</span><strong>{euro(kpi.promoDiscount)}</strong></article>
      <article className={styles.kpi}><span>Jetons en circulation</span><strong>{Math.trunc(kpi.casinoBalance).toLocaleString("fr-FR")}</strong></article>
      <article className={styles.kpi}><span>Écuries validées</span><strong>{kpi.approvedTeams}</strong></article>
      <article className={styles.kpi}><span>Pôles en maintenance</span><strong>{kpi.maintenanceActive}</strong></article>
    </section>
    <section className={`${styles.grid2} ${styles.page}`} style={{paddingBottom:0,width:"100%"}}>
      <article className={styles.card}><h2>Centre de pilotage</h2><p>Accès rapide aux modules Direction.</p><div className={styles.actions}>
        <Link className={styles.buttonAlt} href="/dashboard/recherche">Recherche globale</Link><Link className={styles.buttonAlt} href="/dashboard/crm-motors">CRM Motors</Link><Link className={styles.buttonAlt} href="/dashboard/codes-promo">Codes promo</Link><Link className={styles.buttonAlt} href="/dashboard/billetterie">Billetterie</Link><Link className={styles.buttonAlt} href="/dashboard/sauvegardes">Sauvegardes</Link>
      </div></article>
      <article className={styles.card}><h2>État des pôles</h2><div className={styles.stack}>{maintenance.map(p=><div className={styles.row} key={p.poleKey}><span>{p.title}</span><span className={styles.pill}>{p.enabled?"MAINTENANCE":"EN LIGNE"}</span></div>)}</div><div style={{marginTop:16}}><Link className={styles.buttonAlt} href="/dashboard/maintenance-poles">Gérer les maintenances</Link></div></article>
    </section>
  </DashboardShell>;
}
