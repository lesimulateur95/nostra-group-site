import { redirect } from "next/navigation";

import {
  deactivateLoyaltyCard,
  generateLoyaltyCard,
} from "@/app/actions/loyalty-cards";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getOfficialLoyaltyCardImage,
  LoyaltyCard,
} from "@/components/loyalty/loyalty-card";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getLoyaltyCitizens } from "@/lib/loyalty-cards/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    generated?: string;
    deactivated?: string;
    error?: string;
  }>;
};

const tiers = ["Silver", "Gold", "Black Signature"] as const;

export default async function LoyaltyDashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/dashboard");

  const [params, overview] = await Promise.all([
    searchParams,
    getLoyaltyCitizens(),
  ]);

  const errorMessage =
    params.error === "setup"
      ? "Exécute le SQL V114 pour activer les cartes de fidélité."
      : params.error === "name"
        ? "Le citoyen doit avoir un prénom et un nom RP avant la génération."
        : params.error === "tier"
          ? "Le grade de fidélité sélectionné est invalide."
          : params.error
            ? "La carte n’a pas pu être enregistrée."
            : null;

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">NOSTRA MOTORS</span>
          <h1 className="page-title">Cartes et grades de fidélité</h1>
          <p className="lead">
            Génère une carte personnalisée avec le nom du citoyen et un numéro
            unique. Une carte générée pour un autre citoyen ne désactive jamais
            les cartes déjà actives.
          </p>
        </div>
      </section>

      {!overview.configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Exécute le fichier SQL V114 avant d’utiliser ce module.
        </div>
      )}
      {params.generated && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Carte <strong>{params.generated}</strong> générée avec succès.
        </div>
      )}
      {params.deactivated && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La carte du citoyen a été désactivée.
        </div>
      )}
      {errorMessage && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errorMessage}
        </div>
      )}

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">MODÈLES OFFICIELS</p>
        <h2>Cartes Nostra Motors utilisées dans les profils</h2>
        <p>
          Les cartes générées utilisent maintenant exactement les modèles Silver,
          Gold et Black Signature de Nostra Motors. Le nom, le prénom et le numéro
          unique sont ajoutés automatiquement sur la zone membre.
        </p>
      </section>

      <div className="loyalty-official-template-grid-v115">
        {tiers.map((tier) => (
          <article className="dashboard-panel loyalty-official-template-v115" key={tier}>
            <div>
              <span className="eyebrow">MODÈLE</span>
              <h3>{tier}</h3>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getOfficialLoyaltyCardImage(tier)}
              alt={`Modèle officiel ${tier}`}
            />
          </article>
        ))}
      </div>

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">CITOYENS</p>
        <h2>Génération des cartes</h2>
      </section>

      <div className="loyalty-citizen-list-v114">
        {overview.citizens.map((citizen) => {
          const fullName =
            [citizen.rp_first_name, citizen.rp_last_name]
              .filter(Boolean)
              .join(" ") || citizen.discord_name || "Citoyen sans nom RP";

          return (
            <article className="dashboard-panel loyalty-citizen-row-v114" key={citizen.user_id}>
              <div className="loyalty-citizen-copy-v114">
                <span className="eyebrow">CITOYEN</span>
                <h3>{fullName}</h3>
                <p>
                  Grade actuel : <strong>{citizen.tier ?? "Aucun"}</strong> ·
                  Achats : {citizen.purchases_count} · Remise : {citizen.discount_percent} %
                </p>
              </div>

              {citizen.active_card ? (
                <div className="loyalty-citizen-card-v114">
                  <LoyaltyCard card={citizen.active_card} compact />
                  <form action={deactivateLoyaltyCard}>
                    <input
                      type="hidden"
                      name="card_id"
                      value={citizen.active_card.id}
                    />
                    <button className="btn btn-secondary" type="submit">
                      Désactiver cette carte
                    </button>
                  </form>
                </div>
              ) : (
                <p className="empty-state">Aucune carte active.</p>
              )}

              <form action={generateLoyaltyCard} className="loyalty-generate-form-v114">
                <input type="hidden" name="user_id" value={citizen.user_id} />
                <label>
                  <span>Nouveau grade</span>
                  <select name="tier" defaultValue={citizen.tier ?? "Silver"}>
                    {tiers.map((tier) => (
                      <option value={tier} key={tier}>{tier}</option>
                    ))}
                  </select>
                </label>
                <button className="btn" type="submit">
                  {citizen.active_card ? "Changer / régénérer la carte" : "Générer la carte"}
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </DashboardShell>
  );
}
