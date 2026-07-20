
"use client";

import { useEffect, useState } from "react";
import {
  deleteMyHomeReview,
  saveHomeReview,
} from "@/app/actions/reviews";
import type {
  HomeReview,
  HomeReviewsData,
} from "@/lib/reviews/types";
import styles from "./home-reviews.module.css";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function Stars({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      className={styles.stars}
      title={label}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          className={
            index < Math.round(value)
              ? styles.starActive
              : styles.starInactive
          }
          key={index}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function HomeReviews({
  initialData,
  saved,
  deleted,
  error,
}: {
  initialData: HomeReviewsData;
  saved: boolean;
  deleted: boolean;
  error: string | null;
}) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const response = await fetch("/api/reviews/home", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const nextData =
          (await response.json()) as HomeReviewsData;

        if (active) setData(nextData);
      } catch {
        // Une coupure temporaire ne doit pas vider les avis affichés.
      }
    };

    const timer = window.setInterval(refresh, 4_000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
    };
  }, []);

  const myReview = data.current_user_review;

  return (
    <section className={styles.section} id="avis-clients">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            EXPÉRIENCE CLIENT
          </span>
          <h2>Les avis Nostra Group</h2>
          <p>
            Partage ton expérience et découvre les avis laissés par
            les autres citoyens.
          </p>
        </div>

        <div className={styles.summary}>
          <strong>
            {data.total === 0
              ? "—"
              : data.average.toFixed(1).replace(".", ",")}
          </strong>
          <Stars
            value={data.average}
            label={`${data.average.toFixed(1)} étoiles sur 5`}
          />
          <span>
            {data.total} avis publié
            {data.total > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {!data.configured ? (
        <article className={styles.setup}>
          <h3>Activation V39 nécessaire</h3>
          <p>
            Le Gérant doit exécuter le SQL V39 dans Supabase pour
            ouvrir l’espace des avis.
          </p>
        </article>
      ) : (
        <div className={styles.layout}>
          <article className={styles.formPanel}>
            <span className={styles.eyebrow}>
              {myReview ? "MODIFIER MON AVIS" : "LAISSER UN AVIS"}
            </span>
            <h3>
              {myReview
                ? "Ton avis est déjà publié"
                : "Comment s’est passée ton expérience ?"}
            </h3>
            <p>
              Ton prénom et ton nom RP seront affichés
              automatiquement avec ton avis.
            </p>

            {saved && (
              <div className={styles.success}>
                Ton avis a été publié et il est visible par tous.
              </div>
            )}

            {deleted && (
              <div className={styles.success}>
                Ton avis a été supprimé.
              </div>
            )}

            {error && (
              <div className={styles.error}>
                {error === "invalid"
                  ? "Choisis une note et écris au moins 10 caractères."
                  : "L’avis n’a pas pu être enregistré."}
              </div>
            )}

            <form action={saveHomeReview} className={styles.form}>
              <fieldset>
                <legend>Ma note</legend>
                <div className={styles.ratingChoices}>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <label key={rating}>
                      <input
                        type="radio"
                        name="rating"
                        value={rating}
                        defaultChecked={
                          myReview?.rating === rating ||
                          (!myReview && rating === 5)
                        }
                        required
                      />
                      <span>
                        {rating} ★
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label>
                Titre facultatif
                <input
                  name="title"
                  maxLength={120}
                  defaultValue={myReview?.title ?? ""}
                  placeholder="Exemple : Une excellente expérience"
                />
              </label>

              <label>
                Mon avis
                <textarea
                  name="comment"
                  minLength={10}
                  maxLength={1500}
                  rows={6}
                  required
                  defaultValue={myReview?.comment ?? ""}
                  placeholder="Raconte ton expérience avec Nostra Motors, le Nostra Circuit ou Nostra Group…"
                />
              </label>

              <button className={styles.submitButton} type="submit">
                {myReview
                  ? "Enregistrer les modifications"
                  : "Publier mon avis"}
              </button>
            </form>

            {myReview && (
              <form action={deleteMyHomeReview}>
                <button
                  className={styles.deleteButton}
                  type="submit"
                >
                  Supprimer mon avis
                </button>
              </form>
            )}
          </article>

          <section className={styles.reviewsPanel}>
            <header className={styles.listHeader}>
              <div>
                <span className={styles.eyebrow}>
                  AVIS PUBLIÉS
                </span>
                <h3>Ce que pensent les citoyens</h3>
              </div>
              <span className={styles.liveBadge}>
                <i />
                Actualisation automatique
              </span>
            </header>

            <div className={styles.reviewList}>
              {data.reviews.length === 0 && (
                <div className={styles.empty}>
                  <span>☆</span>
                  <strong>Aucun avis pour le moment</strong>
                  <p>Le premier avis apparaîtra ici.</p>
                </div>
              )}

              {data.reviews.map((review) => (
                <ReviewCard review={review} key={review.id} />
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: HomeReview }) {
  return (
    <article className={styles.reviewCard}>
      <header>
        <div className={styles.avatar}>
          {review.author_name.charAt(0).toUpperCase()}
        </div>
        <div className={styles.author}>
          <strong>{review.author_name}</strong>
          <time dateTime={review.updated_at}>
            {formatDate(review.updated_at)}
          </time>
        </div>
        <Stars
          value={review.rating}
          label={`${review.rating} étoiles sur 5`}
        />
      </header>

      {review.title && <h4>{review.title}</h4>}
      <p>{review.comment}</p>
    </article>
  );
}
