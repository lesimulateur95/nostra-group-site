"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  abandonVehicleAuction,
  placeAuctionBid,
} from "@/app/actions/auctions";
import type { AuctionWithBids } from "@/lib/auctions/data";
import styles from "@/components/auctions/auctions.module.css";

const increments = [
  100,
  1_000,
  10_000,
  50_000,
  100_000,
  500_000,
  1_000_000,
];

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function countdown(endDate: string, now: number): string {
  const remaining = Math.max(0, new Date(endDate).getTime() - now);

  if (remaining <= 0) return "Terminée";

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [
    days > 0 ? `${days}j` : null,
    `${String(hours).padStart(2, "0")}h`,
    `${String(minutes).padStart(2, "0")}m`,
    `${String(seconds).padStart(2, "0")}s`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function AuctionBoard({
  auctions,
  currentUserId,
  bidSaved,
  abandoned,
  bidError,
}: {
  auctions: AuctionWithBids[];
  currentUserId: string;
  bidSaved: boolean;
  abandoned: boolean;
  bidError: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    const refresh = window.setInterval(() => {
      router.refresh();
    }, 5_000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [router]);

  const active = useMemo(
    () =>
      auctions.filter(
        (auction) =>
          auction.status === "active" &&
          new Date(auction.ends_at).getTime() > now,
      ),
    [auctions, now],
  );

  const ended = useMemo(
    () =>
      auctions.filter(
        (auction) =>
          auction.status !== "active" ||
          new Date(auction.ends_at).getTime() <= now,
      ),
    [auctions, now],
  );

  const errorMessage =
    bidError === "abandoned"
      ? "Tu as abandonné cette vente et tu ne peux plus enchérir."
      : bidError === "ended"
        ? "Cette vente aux enchères est déjà terminée."
        : bidError
          ? "L’enchère n’a pas pu être enregistrée."
          : null;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>ÉVÉNEMENTS & JEUX</span>
        <h1>Ventes aux enchères</h1>
        <p>
          Les ventes restent ouvertes jusqu’à la fin du compteur. Chaque
          bouton ajoute son montant à l’enchère actuelle.
        </p>
      </section>

      {bidSaved && (
        <div className={styles.success}>
          Ton enchère a bien été enregistrée.
        </div>
      )}

      {abandoned && (
        <div className={styles.success}>
          Tu as abandonné cette vente. Tes enchères déjà enregistrées restent
          dans l’historique.
        </div>
      )}

      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <div>
            <span className={styles.eyebrow}>EN COURS</span>
            <h2>Ventes actives</h2>
          </div>
          <strong>{active.length}</strong>
        </div>

        {active.length === 0 && (
          <div className={styles.empty}>
            Aucune vente aux enchères n’est ouverte actuellement.
          </div>
        )}

        <div className={styles.auctionList}>
          {active.map((auction) => {
            const userIsLeader =
              auction.winner_id === currentUserId;
            const latestBids = auction.bids.slice(0, 100);

            return (
              <article className={styles.auctionCard} key={auction.id}>
                <div className={styles.auctionTop}>
                  <div className={styles.vehicleMedia}>
                    {auction.vehicle_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={auction.vehicle_image_url}
                        alt={auction.vehicle_label}
                      />
                    ) : (
                      <span>NM</span>
                    )}
                  </div>

                  <div className={styles.auctionSummary}>
                    <span className={styles.eyebrow}>
                      VENTE AUTOMATIQUE
                    </span>
                    <h2>{auction.vehicle_label}</h2>

                    {auction.description && (
                      <p>{auction.description}</p>
                    )}

                    <div className={styles.priceGrid}>
                      <div>
                        <span>Prix de départ</span>
                        <strong>{money(auction.start_price)}</strong>
                      </div>

                      <div>
                        <span>Enchère actuelle</span>
                        <strong>{money(auction.current_price)}</strong>
                      </div>

                      <div>
                        <span>Meilleur enchérisseur</span>
                        <strong>
                          {auction.winner_name ?? "Aucune enchère"}
                        </strong>
                      </div>

                      <div>
                        <span>Temps restant</span>
                        <strong className={styles.timer}>
                          {countdown(auction.ends_at, now)}
                        </strong>
                      </div>
                    </div>

                    {userIsLeader && (
                      <div className={styles.leading}>
                        Tu es actuellement en tête de cette vente.
                      </div>
                    )}
                  </div>
                </div>

                {!auction.currentUserAbandoned ? (
                  <div className={styles.bidPanel}>
                    <h3>Ajouter à l’enchère actuelle</h3>

                    <div className={styles.bidButtons}>
                      {increments.map((increment) => (
                        <form action={placeAuctionBid} key={increment}>
                          <input
                            type="hidden"
                            name="auction_id"
                            value={auction.id}
                          />
                          <button
                            name="increment"
                            value={increment}
                            type="submit"
                          >
                            + {money(increment)}
                          </button>
                        </form>
                      ))}
                    </div>

                    <form
                      action={abandonVehicleAuction}
                      className={styles.abandonForm}
                    >
                      <input
                        type="hidden"
                        name="auction_id"
                        value={auction.id}
                      />
                      <button type="submit">Abandonner</button>
                    </form>
                  </div>
                ) : (
                  <div className={styles.abandonedState}>
                    Tu as abandonné cette vente et les boutons de mise sont
                    désactivés.
                  </div>
                )}

                <div className={styles.history}>
                  <div className={styles.historyHead}>
                    <h3>Historique des enchères</h3>
                    <span>{auction.bids.length} mise(s)</span>
                  </div>

                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Nom et prénom</th>
                          <th>Enchère</th>
                          <th>Ajout</th>
                          <th>Date et heure</th>
                        </tr>
                      </thead>

                      <tbody>
                        {latestBids.length === 0 && (
                          <tr>
                            <td colSpan={4}>
                              Aucune enchère pour le moment.
                            </td>
                          </tr>
                        )}

                        {latestBids.map((bid) => (
                          <tr key={bid.id}>
                            <td>{bid.bidder_name}</td>
                            <td>{money(bid.amount)}</td>
                            <td>+ {money(bid.increment_amount)}</td>
                            <td>{dateTime(bid.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <div>
            <span className={styles.eyebrow}>RÉSULTATS</span>
            <h2>Ventes terminées</h2>
          </div>
          <strong>{ended.length}</strong>
        </div>

        {ended.length === 0 ? (
          <div className={styles.empty}>
            Aucun résultat d’enchère pour le moment.
          </div>
        ) : (
          <div className={styles.endedGrid}>
            {ended.map((auction) => (
              <article className={styles.endedCard} key={auction.id}>
                <span className={styles.eyebrow}>
                  {auction.status === "cancelled"
                    ? "VENTE ANNULÉE"
                    : "VENTE TERMINÉE"}
                </span>
                <h3>{auction.vehicle_label}</h3>

                {auction.status === "cancelled" ? (
                  <p>Cette vente a été annulée par la Direction.</p>
                ) : auction.winner_name ? (
                  <>
                    <p>
                      Remportée par <strong>{auction.winner_name}</strong>
                    </p>
                    <strong className={styles.finalPrice}>
                      {money(auction.current_price)}
                    </strong>
                  </>
                ) : (
                  <p>Aucune enchère n’a été enregistrée.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
