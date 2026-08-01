import { CasinoCashier } from "@/components/casino/casino-cashier";
import { getCasinoConversions, getCasinoProfile, getCasinoSettings, getCasinoWallet } from "@/lib/casino/data";
import { getCitizenBankInformation } from "@/lib/game-bank/data";
import styles from "@/components/casino/casino.module.css";

function n(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

export default async function CasinoCashierPage() {
  const [settings, wallet, conversions, profile] = await Promise.all([
    getCasinoSettings(),
    getCasinoWallet(),
    getCasinoConversions(),
    getCasinoProfile(),
  ]);
  const banking = await getCitizenBankInformation(profile?.steamId ?? null);
  return (
    <>
      <section className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>LA CAISSE</p><h1>Obtenir des jetons</h1></div>
        <p>Convertis ton argent RP en jetons du Cercle. Chaque mouvement reste enregistré et contrôlable depuis le Dashboard.</p>
      </section>
      <div className={styles.cashierGrid}>
        <div className={styles.formStack}>
          <section className={styles.balanceHero}>
            <span>Portefeuille du Cercle</span>
            <strong>{wallet ? n(wallet.balance) : "—"} jetons</strong>
            <small>1 jeton = {n(settings.rpPerChip)} € RP</small>
          </section>
          <section className={styles.panel}>
            <p className={styles.eyebrow}>CONVERSION SÉCURISÉE</p>
            <h2>Choisis ton montant</h2>
            <div style={{ marginTop: 22 }}><CasinoCashier rpPerChip={settings.rpPerChip} minimum={settings.minConversion} maximum={settings.maxConversion} rpBalance={banking.total} paymentStatus={banking.status} /></div>
          </section>
        </div>
        <aside className={styles.panel}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>MES DEMANDES</p><h2>Suivi de caisse</h2></div></div>
          <div className={styles.historyList}>
            {conversions.length ? conversions.map((item) => (
              <div className={styles.historyRow} key={item.id}>
                <span><strong>{n(item.chipAmount)} jetons</strong><small>{n(item.rpAmount)} € RP</small></span>
                <span className={styles[item.status]}>{item.status === "pending" ? "Ancienne demande" : item.status === "approved" ? "Payé" : item.status === "rejected" ? "Refusé" : "Annulé"}</span>
              </div>
            )) : <div className={styles.notice}>Aucune demande pour le moment.</div>}
          </div>
          <div className={styles.notice} style={{ marginTop: 18 }}>Le prix est débité directement sur l’argent RP du personnage connecté. Si le crédit des jetons échoue, le remboursement RP est lancé automatiquement.</div>
        </aside>
      </div>
    </>
  );
}
