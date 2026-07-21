import Link from "next/link";

import { getActiveAuctionCount } from "@/lib/auctions/data";
import styles from "@/components/auctions/auctions.module.css";

export async function AuctionPortalCard() {
  const activeCount = await getActiveAuctionCount();

  return (
    <section className={styles.portalSection}>
      <Link
        className={styles.portalCard}
        href="/evenements/ventes-aux-encheres"
      >
        <span className={styles.portalIcon} aria-hidden="true">
          🔨
        </span>

        <span className={styles.portalCopy}>
          <span className={styles.eyebrow}>VENTES LONGUES</span>
          <strong>Ventes aux enchères</strong>
          <span>
            Enchéris librement pendant toute la durée du compteur, même
            lorsque la Direction n’est pas présente.
          </span>
        </span>

        <span className={styles.portalBadge}>
          {activeCount > 0
            ? `${activeCount} en cours`
            : "Voir les ventes"}
        </span>
      </Link>
    </section>
  );
}
