import { redirect } from "next/navigation";

import {
  deactivateLoyaltyCard,
  deleteAllLoyaltyCardsAndResetCounters,
  generateLoyaltyCard,
  removeLoyaltyGrade,
  resetLoyaltyCardCounters,
} from "@/app/actions/loyalty-cards";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getOfficialLoyaltyCardImage,
  LoyaltyCard,
} from "@/components/loyalty/loyalty-card";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getLoyaltyCitizens,
} from "@/lib/loyalty-cards/data";
import { createClient } from "@/lib/supabase/server";
import { getLoyaltyTiersV155, type LoyaltyTierV155 } from "@/lib/v155/data";
import { updateLoyaltyTierV155 } from "@/app/actions/v155";
import v155Styles from "@/components/v155/v155.module.css";

type PageProps = {
  searchParams: Promise<{
    generated?: string;
    deactivated?: string;
    cards_deleted?: string;
    counters_reset?: string;
    grade_removed?: string;
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

  const [params, overview, editableTiersRaw] = await Promise.all([
    searchParams,
    getLoyaltyCitizens(),
    getLoyaltyTiersV155(),
  ]);
  const editableTiers: LoyaltyTierV155[] = editableTiersRaw;
  const currentYear = new Date().getFullYear();

  const errorMessage =
    params.error === "setup_v126"
      ? "Exécute le SQL V126 pour activer la suppression individuelle d’un grade de fidélité."
      : params.error === "setup_v124"
      ? "Exécute le SQL V124 pour réparer la suppression des cartes et les compteurs."
      : params.error === "setup"
        ? "La base fidélité n’est pas entièrement configurée."
      : params.error === "name"
        ? "Le citoyen doit avoir un prénom et un nom RP avant la génération."
        : params.error === "tier"
          ? "Le grade de fidélité sélectionné est invalide."
          : params.error === "cards_exist"
            ? "Impossible de remettre seulement les compteurs à zéro tant que des cartes existent. Supprime d’abord toutes les cartes."
            : params.error === "confirmation"
              ? "La confirmation de suppression est invalide."
              : params.error === "confirmation_grade"
                ? "La confirmation pour retirer le grade est invalide."
                : params.error === "invalid_user"
                  ? "Le citoyen sélectionné est invalide."
              : params.error === "forbidden"
                ? "Ton compte n’a pas l’autorisation de gérer les cartes de fidélité."
                : params.error === "delete_blocked"
                  ? "Une donnée liée bloque la suppression. Exécute le SQL V124 puis réessaie."
                  : params.error
                    ? "L’opération n’a pas pu être enregistrée. Consulte les logs Vercel si le problème continue."
                    : null;

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">NOSTRA MOTORS</span>
          <h1 className="page-title">Cartes et grades de fidélité</h1>
          <p className="lead">
            Génère une carte personnalisée avec le nom du citoyen et un numéro
            unique. Les compteurs Silver, Gold et Black Signature restent
            indépendants.
          </p>
        </div>
      </section>

      {!overview.configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Exécute le fichier SQL V124 si les actions de maintenance ne fonctionnent pas.
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
      {params.cards_deleted && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Toutes les cartes ont été supprimées et les trois compteurs sont
          repartis de zéro.
        </div>
      )}
      {params.counters_reset && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Les compteurs Silver, Gold et Black Signature ont été remis à zéro.
        </div>
      )}
      {params.grade_removed && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le grade de fidélité a été retiré. La carte active du citoyen a été
          désactivée et sa remise est revenue à 0 %.
        </div>
      )}
      {errorMessage && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errorMessage}
        </div>
      )}

      <section className="dashboard-panel">
        <div className="dashboard-section-heading dashboard-section-heading-tight">
          <p className="eyebrow">FIDÉLITÉ GLOBALE V155</p>
          <h2>Avantages modifiables en direct</h2>
          <p>Modifie ici les avantages, seuils et remises. Les pages citoyennes lisent directement ces valeurs en base : aucun redéploiement n’est nécessaire.</p>
        </div>
        <div className={v155Styles.grid}>
          {editableTiers.map((tier) => (
            <form action={updateLoyaltyTierV155} className={v155Styles.card} key={tier.code}>
              <input type="hidden" name="code" value={tier.code} />
              <h3>{tier.label}</h3>
              <div className={v155Styles.formGrid}>
                <label>Nom public<input className={v155Styles.input} name="label" defaultValue={tier.label} /></label>
                <label>Points minimum<input className={v155Styles.input} type="number" name="min_points" defaultValue={tier.minPoints} /></label>
                <label>Remise catalogue (%)<input className={v155Styles.input} type="number" step="0.1" name="catalog_discount_percent" defaultValue={tier.catalogDiscount} /></label>
                <label>Remise plaques (%)<input className={v155Styles.input} type="number" step="0.1" name="plate_discount_percent" defaultValue={tier.plateDiscount} /></label>
                <label className={v155Styles.full}>Description<input className={v155Styles.input} name="public_description" defaultValue={tier.description ?? ""} /></label>
                <label className={v155Styles.full}>Avantages · 1 ligne = 1 avantage<textarea className={v155Styles.textarea} name="benefits" defaultValue={tier.benefits.join("\n")} /></label>
                <label><input type="checkbox" name="active" defaultChecked={tier.active} /> Niveau actif</label>
                <button className={`${v155Styles.button} ${v155Styles.full}`} type="submit">Enregistrer ce niveau</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-section-heading dashboard-section-heading-tight">
          <p className="eyebrow">RÈGLES DE REMISE</p>
          <h2>Pourcentages officiels</h2>
          <p>
            Les remises affichées ci-dessous sont maintenant lues directement dans la base et suivent les valeurs configurées dans le bloc V155 ci-dessus.
          </p>
        </div>
        <dl className="contract-summary-v114">
          {tiers.map((tier) => (
            <div key={tier}>
              <dt>{tier}</dt>
              <dd>{editableTiers.find((item) => item.label.toLowerCase() === tier.toLowerCase())?.catalogDiscount ?? 0} %</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-section-heading dashboard-section-heading-tight">
          <p className="eyebrow">MAINTENANCE</p>
          <h2>Cartes et compteurs</h2>
          <p>
            {overview.cards_count} carte(s) enregistrée(s), dont {overview.active_cards_count} active(s).
            Une remise à zéro simple des compteurs est autorisée uniquement
            lorsqu’aucune carte n’existe, afin d’éviter deux numéros identiques.
          </p>
        </div>

        <dl className="contract-summary-v114">
          {tiers.map((tier) => {
            const counter = overview.counters.find(
              (item) => item.tier === tier && item.card_year === currentYear,
            );
            return (
              <div key={tier}>
                <dt>{tier} — {currentYear}</dt>
                <dd>{String(counter?.last_number ?? 0).padStart(6, "0")}</dd>
              </div>
            );
          })}
        </dl>

        <div className="dashboard-actions">
          <form action={resetLoyaltyCardCounters}>
            <button className="btn btn-secondary" type="submit">
              Remettre les compteurs à zéro
            </button>
          </form>

          <form action={deleteAllLoyaltyCardsAndResetCounters}>
            <input
              type="hidden"
              name="confirmation"
              value="SUPPRIMER_TOUTES_LES_CARTES"
            />
            <button className="btn btn-danger-v98" type="submit">
              Supprimer toutes les cartes et remettre à zéro
            </button>
          </form>
        </div>
      </section>

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">MODÈLES OFFICIELS</p>
        <h2>Cartes Nostra Motors utilisées dans les profils</h2>
        <p>
          Les cartes générées utilisent exactement les modèles Silver, Gold et
          Black Signature de Nostra Motors. Le nom, le prénom et le numéro unique
          sont ajoutés automatiquement sur la zone membre.
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

              {citizen.tier && (
                <form action={removeLoyaltyGrade}>
                  <input type="hidden" name="user_id" value={citizen.user_id} />
                  <input
                    type="hidden"
                    name="confirmation"
                    value="RETIRER_LE_GRADE"
                  />
                  <button className="btn btn-danger-v98" type="submit">
                    Retirer le grade de fidélité
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </DashboardShell>
  );
}
