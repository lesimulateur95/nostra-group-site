import Link from "next/link";
import { redirect } from "next/navigation";

import { LoyaltyCard } from "@/components/loyalty/loyalty-card";
import {
  getActiveLoyaltyCard,
  getLoyaltyDiscountPercent,
} from "@/lib/loyalty-cards/data";
import { createClient } from "@/lib/supabase/server";
import { getLoyaltyTiersV155 } from "@/lib/v155/data";
import stylesV155 from "@/components/v155/v155.module.css";

export default async function ProfileLoyaltyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [card, loyalty, tiers, pointsResult] = await Promise.all([
    getActiveLoyaltyCard(data.user.id),
    supabase
      .from("loyalty_profiles")
      .select("tier,purchases_count,discount_percent,updated_at")
      .eq("user_id", data.user.id)
      .maybeSingle(),
    getLoyaltyTiersV155(),
    (supabase as any).rpc("nostra_loyalty_points_v155", { p_user_id: data.user.id }),
  ]);
  const currentTierName = card?.tier ?? loyalty.data?.tier ?? "";
  const currentTier = tiers.find((tier) => tier.label.toLowerCase() === currentTierName.toLowerCase() || tier.code.toLowerCase() === currentTierName.toLowerCase().replaceAll(" ", "_"));
  const loyaltyDiscountPercent = currentTier?.catalogDiscount ?? getLoyaltyDiscountPercent(currentTierName);
  const points = Number(pointsResult.data ?? 0);

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

      <section className={stylesV155.card} style={{marginTop: 18}}>
        <span className={stylesV155.eyebrow}>FIDÉLITÉ GLOBALE NOSTRA</span>
        <h2>Mes avantages en direct</h2>
        <div className={stylesV155.grid2}>
          <div className={stylesV155.kpi}><span>Points Nostra</span><strong>{points.toLocaleString("fr-FR")}</strong></div>
          <div className={stylesV155.kpi}><span>Seuil du niveau</span><strong>{currentTier?.minPoints ?? 0}</strong></div>
        </div>
        <p>{currentTier?.description ?? "Les avantages ci-dessous sont ceux configurés actuellement par la Direction."}</p>
        <ul>{(currentTier?.benefits ?? []).map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
      </section>
    </article>
  );
}
