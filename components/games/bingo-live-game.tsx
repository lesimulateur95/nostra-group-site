"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { drawBingoNumber } from "@/app/actions/bingo";
import { BingoCard } from "@/components/games/bingo-card";
import { createClient } from "@/lib/supabase/client";
import type { BingoCard as BingoCardData, BingoDraw, BingoWinner } from "@/lib/backoffice/data";

const phaseLabels: Record<string, string> = {
  one_line: "1 ligne",
  two_lines: "2 lignes",
  three_lines: "3 lignes",
  four_lines: "4 lignes",
  full_card: "Carton plein",
};

export function BingoLiveGame({
  roundId,
  phase,
  status,
  initialDraws,
  initialWinners,
  cards,
  manager,
  showCardsSection = true,
}: {
  roundId: number;
  phase: string;
  status: string;
  initialDraws: BingoDraw[];
  initialWinners: BingoWinner[];
  cards: BingoCardData[];
  manager: boolean;
  showCardsSection?: boolean;
}) {
  const router = useRouter();
  const [showCards, setShowCards] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [animationNumber, setAnimationNumber] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const calledNumbers = useMemo(() => initialDraws.map((draw) => draw.ball_number), [initialDraws]);
  const currentNumber = animationNumber ?? initialDraws[0]?.ball_number ?? null;
  const currentPhaseWinners = initialWinners.filter((winner) => winner.phase === phase);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => router.refresh();
    const channel = supabase
      .channel(`nostra-bingo-live-${roundId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_draws", filter: `round_id=eq.${roundId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_winners", filter: `round_id=eq.${roundId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bingo_rounds", filter: `id=eq.${roundId}` }, refresh)
      .subscribe();

    return () => {
      if (timer.current) clearInterval(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [roundId, router]);

  function handleDraw() {
    if (isPending) return;
    setMessage(null);
    timer.current = setInterval(() => setAnimationNumber(Math.floor(Math.random() * 99) + 1), 70);

    startTransition(async () => {
      const result = await drawBingoNumber();
      if (timer.current) clearInterval(timer.current);
      timer.current = null;

      if (!result.ok || !result.ballNumber) {
        setAnimationNumber(null);
        setMessage(result.error === "complete"
          ? "Le carton plein a déjà été remporté. Réinitialise ou clear le Bingo depuis le Dashboard."
          : result.error === "empty"
            ? "Les 99 numéros ont déjà été tirés."
            : result.error === "manager"
              ? "Seul le Gérant peut sortir un numéro."
              : result.error === "setup"
                ? "Le Bingo doit d’abord être activé depuis le Dashboard."
                : "Le numéro n’a pas pu être enregistré.");
        return;
      }

      setAnimationNumber(result.ballNumber);
      if (result.winners?.length) {
        setMessage(result.winners.map((winner) => `BINGO — grille BG-${String(winner.card_number).padStart(5, "0")} · ${winner.customer_name}`).join(" · "));
      } else {
        setMessage(`Numéro ${result.ballNumber} enregistré.`);
      }
      setTimeout(() => {
        setAnimationNumber(null);
        router.refresh();
      }, 1000);
    });
  }

  return (
    <div className="bingo-live-shell">
      <section className="bingo-live-stage">
        <div className={`bingo-drum ${isPending ? "is-spinning" : ""}`}>
          <div className="bingo-drum-ring">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--ball-index": index } as React.CSSProperties}>{(index * 11 + 1) % 99 || 99}</i>)}</div>
          <div className="bingo-current-ball"><small>NUMÉRO</small><strong>{currentNumber ?? "—"}</strong></div>
        </div>
        <div className="bingo-stage-meta">
          <span>Objectif actuel</span>
          <strong>{phaseLabels[phase] ?? phase}</strong>
          <small>{status === "open" ? "Inscriptions ouvertes" : status === "playing" ? "Partie en cours" : status === "completed" ? "Carton plein remporté" : "Inscriptions fermées"}</small>
        </div>
        {manager && <button className="btn bingo-draw-button" type="button" onClick={handleDraw} disabled={isPending || status === "completed"}>{isPending ? "Tirage en cours…" : "Sortir un numéro"}</button>}
      </section>

      {message && <div className="bingo-live-message" role="status">{message}</div>}
      {currentPhaseWinners.length > 0 && (
        <section className="bingo-winner-alerts" aria-live="polite">
          {currentPhaseWinners.slice(0, 6).map((winner) => (
            <article key={winner.id}><span>🏆 BINGO</span><strong>Grille BG-{String(winner.card_number).padStart(5, "0")}</strong><small>{winner.customer_name} · {phaseLabels[winner.phase] ?? winner.phase}</small></article>
          ))}
        </section>
      )}

      <section className="bingo-number-panels">
        <article className="bingo-latest-panel"><span>DERNIER NUMÉRO SORTI</span><strong>{initialDraws[0]?.ball_number ?? "—"}</strong></article>
        <article className="bingo-history-panel"><span>HISTORIQUE DES NUMÉROS</span><div>{initialDraws.length === 0 && <small>Aucun numéro sorti.</small>}{initialDraws.map((draw) => <b key={draw.id}>{draw.ball_number}</b>)}</div></article>
      </section>

      {showCardsSection && (
        <section className="bingo-my-cards-section">
          <button className="bingo-show-cards-button" type="button" onClick={() => setShowCards((value) => !value)}>{showCards ? "Masquer mes grilles" : `Afficher mes grilles (${cards.length})`}</button>
          {showCards && (
            <div className="bingo-cards-grid">
              {cards.length === 0 && <p className="empty-state">Tu ne possèdes aucune grille pour cette édition.</p>}
              {cards.map((card) => <BingoCard key={card.id} card={card} calledNumbers={calledNumbers} interactive />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
