"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BingoRewardPhase, BingoRewards } from "@/lib/backoffice/data";

const rows: Array<{ key: BingoRewardPhase; label: string }> = [
  { key: "one_line", label: "1 ligne" },
  { key: "two_lines", label: "2 lignes" },
  { key: "three_lines", label: "3 lignes" },
  { key: "four_lines", label: "4 lignes" },
  { key: "full_card", label: "Carton plein" },
];

export function BingoRewardsPanel({
  roundId,
  activePhase,
  rewards,
}: {
  roundId: number;
  activePhase: BingoRewardPhase;
  rewards: BingoRewards;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`nostra-bingo-rewards-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bingo_rewards", filter: `round_id=eq.${roundId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roundId, router]);

  return (
    <aside className="bingo-rewards-panel">
      <header>
        <span>RÉCOMPENSES</span>
        <h2>Cadeaux à gagner</h2>
        <p>Le cadeau correspondant à l’objectif en cours est mis en évidence.</p>
      </header>

      <div className="bingo-rewards-table">
        {rows.map((row) => {
          const value = rewards[row.key].trim();
          return (
            <article className={row.key === activePhase ? "is-active" : ""} key={row.key}>
              <span>{row.label}</span>
              <strong>{value || "À définir par l’organisation"}</strong>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
