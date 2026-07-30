import type { CSSProperties } from "react";

import type { LoyaltyCard as LoyaltyCardData } from "@/lib/loyalty-cards/data";

function tierClass(tier: string) {
  if (tier === "Gold") return "loyalty-generated-card-gold";
  if (tier === "Black Signature") return "loyalty-generated-card-black";
  return "loyalty-generated-card-silver";
}

export function LoyaltyCard({
  card,
  compact = false,
}: {
  card: LoyaltyCardData;
  compact?: boolean;
}) {
  const style = card.template_image_url
    ? ({
        "--loyalty-card-background": `url(${JSON.stringify(card.template_image_url).slice(1, -1)})`,
      } as CSSProperties)
    : undefined;

  return (
    <article
      className={`loyalty-generated-card ${tierClass(card.tier)}${compact ? " loyalty-generated-card-compact" : ""}${card.template_image_url ? " loyalty-generated-card-with-image" : ""}`}
      style={style}
    >
      <div className="loyalty-generated-card-overlay" />
      <header>
        <span className="loyalty-generated-card-logo">NM</span>
        <div>
          <strong>NOSTRA MOTORS</strong>
          <small>CARTE DE FIDÉLITÉ</small>
        </div>
      </header>

      <div className="loyalty-generated-card-tier">{card.tier}</div>

      <footer>
        <div>
          <span>TITULAIRE</span>
          <strong>{card.first_name} {card.last_name}</strong>
        </div>
        <div>
          <span>NUMÉRO DE CARTE</span>
          <strong>{card.card_number}</strong>
        </div>
      </footer>
    </article>
  );
}
