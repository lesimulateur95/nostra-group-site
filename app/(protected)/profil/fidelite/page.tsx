import Link from "next/link";
import { redirect } from "next/navigation";

import { LoyaltyCard } from "@/components/loyalty/loyalty-card";
import {
  getActiveLoyaltyCard,
  getLoyaltyDiscountPercent,
} from "@/lib/loyalty-cards/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileLoyaltyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [card, loyalty] = await Promise.all([
    getActiveLoyaltyCard(data.user.id),
    supabase
      .from("loyalty_profiles")
      .select("tier,purchases_count,discount_percent,updated_at")
      .eq("user_id", data.user.id)
      .maybeSingle(),
  ]);
  const loyaltyDiscountPercent = getLoyaltyDiscountPercent(
    card?.tier ?? loyalty.data?.tier,
  );

  return (
    <article className="profile-subpage">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA MOTORS</p>
        <h1 className="page-title">Ma carte de fidélité</h1>
        <p className="lead">
          Retrouve le modèle correspondant à ton grade, ton nom et ton numéro
          de carte personnel.
        </p>
      </header>

      <Link className="btn btn-secondary" href="/profil">
        Retour au profil
      </Link>

      <section className="profile-commerce-card loyalty-profile-page-v114">
        {card ? (
          <LoyaltyCard card={card} />
        ) : (
          <div className="empty-state">
            <h2>Aucune carte active</h2>
            <p>
              {loyalty.data?.tier
                ? `Ton grade ${loyalty.data.tier} est actif. La carte sera générée automatiquement dès que ton nom RP est complet.`
                : "Aucun grade de fidélité ne t’a encore été attribué."}
            </p>
          </div>
        )}

        <dl className="contract-summary-v114">
          <div>
            <dt>Grade</dt>
            <dd>{card?.tier ?? loyalty.data?.tier ?? "Aucun"}</dd>
          </div>
          <div>
            <dt>Achats comptabilisés</dt>
            <dd>{Number(loyalty.data?.purchases_count ?? 0)}</dd>
          </div>
          <div>
            <dt>Remise</dt>
            <dd>{loyaltyDiscountPercent} %</dd>
          </div>
          <div>
            <dt>Numéro</dt>
            <dd>{card?.card_number ?? "Non généré"}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
