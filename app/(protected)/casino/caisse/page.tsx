import { CasinoCashier } from "@/components/casino/casino-cashier";
import { CasinoCashout } from "@/components/casino/casino-cashout";
import {
  getCasinoCashierPackages,
  getCasinoCashouts,
  getCasinoConversions,
  getCasinoProfile,
  getCasinoSettings,
  getCasinoWallet,
} from "@/lib/casino/data";
import { getCitizenBankInformation } from "@/lib/game-bank/data";
import styles from "@/components/casino/casino.module.css";

function n(value: number): string {
  return Math.trunc(value).toLocaleString("fr-FR");
}

export default async function CasinoCashierPage() {
  const [settings, wallet, conversions, cashouts, profile, packages] = await Promise.all([
    getCasinoSettings(),
    getCasinoWallet(),
    getCasinoConversions(),
    getCasinoCashouts(),
    getCasinoProfile(),
    getCasinoCashierPackages(false),
  ]);
  const banking = await getCitizenBankInformation(profile?.steamId ?? null);
  const history = [
    ...conversions.map((item) => ({ ...item, direction: "purchase" as const })),
    ...cashouts.map((item) => ({ ...item, direction: "cashout" as const })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 16);

  return (
    <div className={styles.cashierPageV148}>
      <section className={styles.cashierTitleBlock}>
        <p className={styles.cashierKicker}>· BOUTIQUE · CHANGE ·</p>
        <h1>La caisse</h1>
        <p>
          Convertissez votre argent RP en jetons du casino. Taux officiel : <strong>1 jeton = {n(settings.rpPerChip)} $RP</strong>.
          <br />
          Revente possible avec commission maison de <strong>{settings.cashoutCommissionPercent.toLocaleString("fr-FR")} %</strong>.
        </p>
        <div className={styles.cashierTopBalances}>
          <span><small>SOLDE RP</small><b>{banking.status === "connected" && banking.total !== null ? `${n(banking.total)} $RP` : "INDISPONIBLE"}</b></span>
          <span><small>JETONS DU CERCLE</small><b>{wallet ? `${n(wallet.balance)} JT` : "—"}</b></span>
        </div>
      </section>

      <CasinoCashier
        rpPerChip={settings.rpPerChip}
        minimum={settings.minConversion}
        maximum={settings.maxConversion}
        rpBalance={banking.total}
        paymentStatus={banking.status}
        packages={packages}
      />

      <section className={styles.cashierSellSection}>
        <div className={styles.cashierSellHeading}>
          <div>
            <p className={styles.cashierMiniTitle}>· REVENTE JETONS · COMMISSION {settings.cashoutCommissionPercent.toLocaleString("fr-FR")} %</p>
            <h2>Reprendre des $RP</h2>
          </div>
          <span className={styles.cashierChipStamp}>JT</span>
        </div>
        <CasinoCashout
          enabled={settings.cashoutEnabled}
          rpPerChip={settings.rpPerChip}
          commissionPercent={settings.cashoutCommissionPercent}
          minimum={settings.minCashout}
          maximum={settings.maxCashout}
          chipBalance={wallet?.balance ?? 0}
          paymentStatus={banking.status}
        />
      </section>

      <section className={styles.cashierHistorySection}>
        <header>
          <div><p className={styles.cashierMiniTitle}>· JOURNAL DE CAISSE</p><h2>Dernières opérations</h2></div>
          <small>Achats et reventes enregistrés automatiquement.</small>
        </header>
        <div className={styles.cashierHistoryTable}>
          {history.length ? history.map((item) => (
            <article key={`${item.direction}-${item.id}`}>
              <span className={item.direction === "cashout" ? styles.cashierHistoryOut : styles.cashierHistoryIn}>{item.direction === "cashout" ? "REVENTE" : "ACHAT"}</span>
              <strong>{n(item.chipAmount)} JT</strong>
              <span>{item.direction === "cashout" ? "+" : "−"} {n(item.rpAmount)} $RP</span>
              <small>{new Date(item.createdAt).toLocaleString("fr-FR")}</small>
              <b>{item.status === "pending" ? "EN COURS" : item.status === "approved" ? "VALIDÉ" : item.status === "rejected" ? "REFUSÉ" : "ANNULÉ"}</b>
            </article>
          )) : <div className={styles.cashierEmptyHistory}>Aucune opération enregistrée pour le moment.</div>}
        </div>
      </section>
    </div>
  );
}
