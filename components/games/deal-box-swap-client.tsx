"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  answerDealBoxSwap,
  chooseNewDealBox,
} from "@/app/actions/deal-box-swap";
import type { DealBoxSwapPublicState } from "@/lib/deal/box-swap-types";
import styles from "@/components/games/deal-box-swap.module.css";

const emptyState: DealBoxSwapPublicState = {
  configured: false,
  call: null,
  available_boxes: [],
};

function actionError(code?: string): string {
  if (code === "auth") {
    return "Reconnecte-toi avant de répondre au banquier.";
  }
  if (code === "box") {
    return "Cette boîte ne peut pas être sélectionnée.";
  }
  if (code === "missing") {
    return "Cet appel du banquier n’est plus actif.";
  }

  return "La réponse n’a pas pu être enregistrée.";
}

function playRing() {
  const AudioContextClass =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = 760;
  oscillator.type = "sine";
  gain.gain.value = 0.045;

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();

  window.setTimeout(() => {
    oscillator.stop();
    void context.close();
  }, 240);
}

export function DealBoxSwapClient() {
  const [state, setState] =
    useState<DealBoxSwapPublicState>(emptyState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const previousCallId = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/games/deal/box-swap/state",
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) return;

      const nextState =
        (await response.json()) as DealBoxSwapPublicState;

      setState(nextState);
    } catch {
      // Une coupure momentanée ne ferme pas l'appel.
    }
  }, []);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 1500);

    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const currentId = state.call?.id ?? null;

    if (
      currentId !== null &&
      currentId !== previousCallId.current
    ) {
      playRing();
      window.setTimeout(playRing, 420);
    }

    previousCallId.current = currentId;
  }, [state.call?.id]);

  const run = (
    action: () => Promise<{
      ok: boolean;
      error?: string;
    }>,
  ) => {
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        setError(actionError(result.error));
        return;
      }

      await refresh();
    });
  };

  if (!state.configured || !state.call) return null;

  const choosing = state.call.status === "choosing";

  return (
    <div className={styles.overlay}>
      <section className={styles.callPanel}>
        <div className={styles.phone} aria-hidden="true">
          ☎
        </div>

        <span className={styles.eyebrow}>
          APPEL DU BANQUIER
        </span>

        {!choosing ? (
          <>
            <h2>Voulez-vous changer de boîte&nbsp;?</h2>

            <div className={styles.currentBox}>
              <span>VOTRE BOÎTE ACTUELLE</span>
              <strong>{state.call.current_box}</strong>
            </div>

            <p>
              Vous pouvez conserver votre boîte actuelle ou choisir
              une nouvelle boîte parmi celles encore fermées.
            </p>

            {error && (
              <div className={styles.error}>{error}</div>
            )}

            <div className={styles.decisionButtons}>
              <button
                className={styles.keepButton}
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => answerDealBoxSwap("keep"))
                }
              >
                À laisser — je garde ma boîte
              </button>

              <button
                className={styles.changeButton}
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => answerDealBoxSwap("change"))
                }
              >
                À prendre — je change de boîte
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Choisissez votre nouvelle boîte</h2>

            <p>
              Votre ancienne boîte redeviendra une boîte normale et
              pourra être ouverte plus tard dans la partie.
            </p>

            {error && (
              <div className={styles.error}>{error}</div>
            )}

            <div className={styles.boxGrid}>
              {state.available_boxes.map((boxNumber) => (
                <button
                  key={boxNumber}
                  className={styles.boxChoice}
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(() => chooseNewDealBox(boxNumber))
                  }
                >
                  <span>BOÎTE</span>
                  <strong>{boxNumber}</strong>
                  <small>Sélectionner</small>
                </button>
              ))}
            </div>
          </>
        )}

        {isPending && (
          <div className={styles.pending}>
            Enregistrement de votre choix…
          </div>
        )}
      </section>
    </div>
  );
}
