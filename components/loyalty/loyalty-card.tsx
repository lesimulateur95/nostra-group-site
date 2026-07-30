import type { LoyaltyCard as LoyaltyCardData } from "@/lib/loyalty-cards/data";

const OFFICIAL_CARD_IMAGES: Record<string, string> = {
  Silver: "/images/fidelite/carte-silver.png",
  Gold: "/images/fidelite/carte-gold.png",
  "Black Signature": "/images/fidelite/carte-black-signature.png",
};

function tierClass(tier: string) {
  if (tier === "Gold") return "loyalty-official-card-gold-v115";
  if (tier === "Black Signature") return "loyalty-official-card-black-v115";
  return "loyalty-official-card-silver-v115";
}

export function getOfficialLoyaltyCardImage(tier: string) {
  return OFFICIAL_CARD_IMAGES[tier] ?? OFFICIAL_CARD_IMAGES.Silver;
}

export function LoyaltyCard({
  card,
  compact = false,
}: {
  card: LoyaltyCardData;
  compact?: boolean;
}) {
  const fullName = `${card.first_name} ${card.last_name}`.trim();
  const imageSrc = getOfficialLoyaltyCardImage(card.tier);

  return (
    <article
      className={`loyalty-official-card-v115 ${tierClass(card.tier)}${compact ? " loyalty-official-card-compact-v115" : ""}`}
      aria-label={`Carte de fidélité ${card.tier} de ${fullName}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="loyalty-official-card-image-v115"
        src={imageSrc}
        alt={`Modèle officiel de la carte ${card.tier}`}
      />

      <div className="loyalty-official-card-personalization-v115">
        <span>{fullName || "MEMBRE NOSTRA"}</span>
        <strong>{card.card_number}</strong>
      </div>
    </article>
  );
}
