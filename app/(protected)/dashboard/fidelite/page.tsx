import { redirect } from "next/navigation";

import {
  deactivateLoyaltyCard,
  generateLoyaltyCard,
  updateLoyaltyCardTemplate,
} from "@/app/actions/loyalty-cards";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LoyaltyCard } from "@/components/loyalty/loyalty-card";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getLoyaltyCitizens } from "@/lib/loyalty-cards/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    generated?: string;
    deactivated?: string;
    template_saved?: string;
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
      {params.template_saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le modèle de carte a été enregistré.
        </div>
      )}
      {errorMessage && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errorMessage}
        </div>
      )}

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">MODÈLES</p>
        <h2>Arrière-plans des cartes</h2>
        <p>
          Les modèles déjà utilisés par ton espace fidélité peuvent être reliés
          ici avec leur URL d’image. Sans URL, le site utilise le modèle intégré.
        </p>
      </section>

      <div className="loyalty-template-grid-v114">
        {tiers.map((tier) => {
          const template = overview.templates.find((item) => item.tier === tier);
          return (
            <form
              action={updateLoyaltyCardTemplate}
              className="dashboard-panel loyalty-template-form-v114"
              key={tier}
            >
              <input type="hidden" name="tier" value={tier} />
              <strong>{tier}</strong>
              <label>
                <span>URL du modèle</span>
                <input
                  type="url"
                  name="image_url"
                  defaultValue={template?.image_url ?? ""}
                  placeholder="https://.../carte-silver.png"
                />
              </label>
              <button className="btn" type="submit">
                Enregistrer le modèle
              </button>
            </form>
          );
        })}
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
