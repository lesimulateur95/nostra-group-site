import { CasinoCashier } from "@/components/casino/casino-cashier";
import { CasinoCashout } from "@/components/casino/casino-cashout";
import { getCasinoCashouts, getCasinoConversions, getCasinoProfile, getCasinoSettings, getCasinoWallet } from "@/lib/casino/data";
import { getCitizenBankInformation } from "@/lib/game-bank/data";
import styles from "@/components/casino/casino.module.css";

function n(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

export default async function CasinoCashierPage() {
  const [settings, wallet, conversions, cashouts, profile] = await Promise.all([
    getCasinoSettings(),
    getCasinoWallet(),
    getCasinoConversions(),
    getCasinoCashouts(),
    getCasinoProfile(),
  ]);
  const banking = await getCitizenBankInformation(profile?.steamId ?? null);
  const history = [
    ...conversions.map((item) => ({ ...item, direction: "purchase" as const })),
    ...cashouts.map((item) => ({ ...item, direction: "cashout" as const })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30);
  return (
    <>
      <section className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>LA CAISSE</p><h1>Acheter ou revendre</h1></div>
        <p>Convertis ton argent RP en jetons, puis revends tes jetons pour récupérer l’argent directement sur ton compte bancaire en jeu.</p>
      </section>
      <div className={styles.cashierGrid}>
        <div className={styles.formStack}>
          <section className={styles.balanceHero}>
            <span>Portefeuille du Cercle</span>
            <strong>{wallet ? n(wallet.balance) : "—"} jetons</strong>
            <small>1 jeton = {n(settings.rpPerChip)} € RP</small>
          </section>
          <section className={styles.panel}>
            <div className={styles.cashierActionHeader}><span>01</span><div><p className={styles.eyebrow}>ACHETER DES JETONS</p><h2>Argent RP → jetons</h2></div></div>
            <div style={{ marginTop: 22 }}><CasinoCashier rpPerChip={settings.rpPerChip} minimum={settings.minConversion} maximum={settings.maxConversion} rpBalance={banking.total} paymentStatus={banking.status} /></div>
          </section>
          <section className={`${styles.panel} ${styles.cashoutPanel}`}>
            <div className={styles.cashierActionHeader}><span>02</span><div><p className={styles.eyebrow}>REVENDRE MES JETONS</p><h2>Jetons → compte en jeu</h2></div></div>
            <div style={{ marginTop: 22 }}><CasinoCashout enabled={settings.cashoutEnabled} rpPerChip={settings.cashoutRpPerChip} minimum={settings.minCashout} maximum={settings.maxCashout} chipBalance={wallet?.balance ?? 0} paymentStatus={banking.status} /></div>
          </section>
        </div>
        <aside className={styles.panel}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>MES OPÉRATIONS</p><h2>Historique de caisse</h2></div></div>
          <div className={styles.historyList}>
            {history.length ? history.map((item) => (
              <div className={styles.historyRow} key={item.id}>
                <span><strong>{item.direction === "cashout" ? "Revente" : "Achat"} · {n(item.chipAmount)} jetons</strong><small>{item.direction === "cashout" ? "+ " : "− "}{n(item.rpAmount)} € RP · {new Date(item.createdAt).toLocaleString("fr-FR")}</small></span>
                <span className={styles[item.status]}>{item.status === "pending" ? "En cours" : item.status === "approved" ? item.direction === "cashout" ? "Crédité" : "Payé" : item.status === "rejected" ? "Refusé" : "Annulé"}</span>
              </div>
            )) : <div className={styles.notice}>Aucune demande pour le moment.</div>}
          </div>
          <div className={styles.notice} style={{ marginTop: 18 }}>Chaque achat et chaque revente sont sécurisés. Si un virement vers la base RP échoue, les jetons réservés sont rendus automatiquement.</div>
        </aside>
      </div>
    </>
  );
}
