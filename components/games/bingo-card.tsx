"use client";

import { useEffect, useMemo, useState } from "react";
import type { BingoCard as BingoCardData } from "@/lib/backoffice/data";

function cardLabel(value: number) {
  return `BG-${String(value).padStart(5, "0")}`;
}

export function BingoCard({
  card,
  calledNumbers,
  interactive = false,
  showOwner = false,
}: {
  card: BingoCardData;
  calledNumbers: number[];
  interactive?: boolean;
  showOwner?: boolean;
}) {
  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const storageKey = `nostra-bingo-marks-${card.round_id}-${card.id}-${card.numbers.join("-")}`;
  const [marked, setMarked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!interactive) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setMarked(new Set(saved.filter((value): value is number => typeof value === "number")));
    } catch {
      setMarked(new Set());
    }
  }, [interactive, storageKey]);

  function toggle(value: number) {
    if (!interactive || value === 0 || !called.has(value)) return;
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value); else next.add(value);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  const markedCount = interactive
    ? [...marked].filter((value) => called.has(value)).length
    : card.numbers.filter((value) => value === 0 || called.has(value)).length - 1;

  return (
    <article className="bingo-card">
      <header>
        <div><span>GRILLE</span><strong>{cardLabel(card.card_number)}</strong></div>
        {showOwner && <small>{card.customer_name}</small>}
        <b>{markedCount}/24</b>
      </header>
      <div className="bingo-card-letters" aria-hidden="true">
        {Array.from("BINGO").map((letter) => <strong key={letter}>{letter}</strong>)}
      </div>
      <div className="bingo-card-grid">
        {card.numbers.map((value, index) => {
          const center = value === 0;
          const isCalled = center || called.has(value);
          const isMarked = center || (!interactive && isCalled) || (interactive && marked.has(value) && isCalled);
          return (
            <button
              key={`${card.id}-${index}`}
              type="button"
              className={`bingo-cell ${center ? "bingo-cell-center" : ""} ${isCalled ? "is-called" : ""} ${isMarked ? "is-marked" : ""}`}
              onClick={() => toggle(value)}
              disabled={!interactive || center || !isCalled}
              title={center ? "Case libre Nostra Motors" : isCalled ? `Numéro ${value} sorti` : `Numéro ${value} pas encore sorti`}
            >
              {center ? <span className="bingo-nm-logo"><i>NM</i><small>NOSTRA<br />MOTORS</small></span> : value}
            </button>
          );
        })}
      </div>
      {interactive && <footer>Clique uniquement sur les numéros annoncés pour les colorier.</footer>}
    </article>
  );
}
