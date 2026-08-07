import Link from "next/link";
import { redirect } from "next/navigation";

import { PilotLicenseForm } from "@/components/circuit/pilot-license-form";
import { getRpName } from "@/lib/auth/user-profile";
import {
  getOwnPilotLicenseCart,
  getPilotLicenseTypes,
} from "@/lib/licenses/data";
import { getMyMailboxOverview } from "@/lib/mail/data";
import {
  getAcademyLicenseEligibilitiesV140,
  type AcademyLicenseEligibilityV140,
} from "@/lib/racing-academy/license-requirements";
import {
  getPilotLicenseServiceKey,
  getServiceAvailabilities,
} from "@/lib/system/service-availability";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function eligibilityMessage(eligibility: AcademyLicenseEligibilityV140): string {
  if (eligibility.reason === "academy_specific_training_required") {
    return eligibility.requiredCourseTitle
      ? `Formation obligatoire : ${eligibility.requiredCourseTitle}`
      : "La formation Academy dédiée à cette licence doit être validée.";
  }
  if (eligibility.reason === "academy_training_expired") {
    return "Ta qualification Academy nécessaire a expiré. Une nouvelle validation est obligatoire.";
  }
  if (eligibility.reason === "license_revoked") {
    return "Cette licence a été retirée par la Direction. Sa réactivation administrative est obligatoire avant tout nouvel achat.";
  }
  if (eligibility.reason === "license_suspended") {
    return "Cette licence est actuellement suspendue. Aucun rachat ni renouvellement n’est possible pendant la suspension.";
  }
  if (eligibility.reason === "prerequisite_license_required") {
    return eligibility.prerequisiteLicenseLabel
      ? `Licence préalable obligatoire : ${eligibility.prerequisiteLicenseLabel}`
      : "Une licence de niveau inférieur valide est obligatoire.";
  }
  if (eligibility.reason === "academy_requirement_disabled") {
    return "Cette progression est temporairement désactivée par la Direction.";
  }
  if (eligibility.reason === "setup") {
    return "Le contrôle Academy V140 doit être activé par la Direction.";
  }
  return "Une qualification Nostra Racing Academy valide est obligatoire.";
}

export default async function PayPilotLicensePage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const licenseTypes = await getPilotLicenseTypes();

  const [
    licenseServices,
    currentCart,
    profileResult,
    mailboxOverview,
    academyEligibilityByCode,
    params,
  ] = await Promise.all([
    getServiceAvailabilities([
      "circuit_license_pilot",
      "circuit_license_gt3rs",
      "circuit_license_f1",
    ]),
    getOwnPilotLicenseCart(authData.user.id),
    (supabase as any)
      .from("member_profiles")
      .select("rp_first_name,rp_last_name,phone")
      .eq("user_id", authData.user.id)
      .maybeSingle(),
    getMyMailboxOverview(),
    getAcademyLicenseEligibilitiesV140(
      authData.user.id,
      licenseTypes.map((license) => license.code),
    ),
    searchParams,
  ]);

  const serviceByKey = new Map(
    licenseServices.map((service) => [service.serviceKey, service]),
  );

  const availableLicenseTypes = licenseTypes.filter((license) => {
    const service = serviceByKey.get(getPilotLicenseServiceKey(license.code));
    const academy = academyEligibilityByCode.get(license.code);
    return service?.isOpen !== false && academy?.eligible === true;
  });

  const closedLicenseServices = licenseTypes.flatMap((license) => {
    const service = serviceByKey.get(getPilotLicenseServiceKey(license.code));
    return service && !service.isOpen ? [{ license, service }] : [];
  });

  const metadata = authData.user.user_metadata ?? {};
  const profile = profileResult.data ?? {};
  const profileName =
    [
      typeof profile.rp_first_name === "string" ? profile.rp_first_name : "",
      typeof profile.rp_last_name === "string" ? profile.rp_last_name : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    getRpName(authData.user) ||
    "";

  const profilePhone =
    typeof profile.phone === "string" && profile.phone.trim()
      ? profile.phone
      : typeof metadata.phone === "string"
        ? metadata.phone
        : "";

  const internalEmail = mailboxOverview.mailbox?.address ?? "";

  const errorMessage =
    params.error === "identity"
      ? "Vérifie le nom, le numéro de téléphone et l’adresse e-mail."
      : params.error === "certificate"
        ? "Ajoute obligatoirement ton certificat médical."
        : params.error === "certificate-type"
          ? "Le certificat doit être au format PDF, JPG ou PNG."
          : params.error === "certificate-size"
            ? "Le certificat dépasse la taille maximale de 10 Mo."
            : params.error === "upload"
              ? "Le certificat médical n’a pas pu être envoyé."
              : params.error === "academy"
                ? "Une qualification Nostra Racing Academy valide est obligatoire avant cet achat."
                : params.error === "academy-specific"
                  ? "Tu dois d’abord réussir la formation Academy prévue pour cette licence."
                  : params.error === "academy-expired"
                    ? "Ta qualification Academy nécessaire a expiré et doit être renouvelée."
                    : params.error === "license-revoked"
                      ? "Achat bloqué : cette licence a été retirée par la Direction."
                      : params.error === "license-suspended"
                        ? "Achat bloqué : cette licence est actuellement suspendue."
                        : params.error === "prerequisite"
                      ? "Tu dois d’abord posséder la licence de niveau inférieur demandée."
                      : params.error === "closed"
                        ? "Cette licence est actuellement clôturée par la Direction."
                        : params.error === "setup"
                          ? "Le module des licences ou le contrôle Academy V140 doit d’abord être activé."
                          : params.error === "mailbox"
                            ? "La messagerie interne doit être activée avant de déposer une demande."
                            : params.error
                              ? "La demande n’a pas pu être ajoutée au panier."
                              : null;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA CIRCUIT · RACING ACADEMY</span>
        <h1>Payer ma licence</h1>
        <p>
          Chaque licence possède désormais son propre parcours Academy. La formation requise, les notes, la licence préalable et l’ouverture des achats sont contrôlées automatiquement.
        </p>
      </section>

      <section className={styles.prices}>
        {licenseTypes.map((license) => {
          const service = serviceByKey.get(getPilotLicenseServiceKey(license.code));
          const isOpen = service?.isOpen !== false;
          const academy = academyEligibilityByCode.get(license.code);

          return (
            <article key={license.code}>
              <span>{license.code}</span>
              <strong>{license.label}</strong>
              <b>
                {!isOpen
                  ? "Achat clôturé"
                  : academy?.eligible
                    ? money(license.price)
                    : academy
                      ? eligibilityMessage(academy)
                      : "Contrôle Academy indisponible"}
              </b>
            </article>
          );
        })}
      </section>

      {licenseTypes.length === 0 && (
        <div className={styles.error}>
          Le module des licences pilotes n’est pas encore configuré.
        </div>
      )}

      {licenseTypes.map((license) => {
        const academy = academyEligibilityByCode.get(license.code);
        if (!academy || academy.eligible) return null;
        return (
          <div className={styles.error} key={`academy-${license.code}`}>
            <strong>{license.label} — prérequis non remplis</strong>
            <p>{eligibilityMessage(academy)}</p>
            {academy.requiredCourseTitle ? (
              <p>Formation attendue : <strong>{academy.requiredCourseTitle}</strong>.</p>
            ) : null}
            {academy.prerequisiteLicenseLabel ? (
              <p>Licence préalable : <strong>{academy.prerequisiteLicenseLabel}</strong>.</p>
            ) : null}
            <Link className="btn btn-secondary" href="/circuit/racing-academy">
              Voir les formations Academy
            </Link>
          </div>
        );
      })}

      {closedLicenseServices.length > 0 && (
        <div className={styles.error}>
          <strong>Achats temporairement clôturés</strong>
          <ul>
            {closedLicenseServices.map(({ license, service }) => (
              <li key={license.code}>
                {license.label} : {service.closedMessage}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      {currentCart && (
        <div className={styles.cartNotice}>
          <div>
            <strong>Une demande est déjà dans ton panier</strong>
            <p>
              {currentCart.license_label} — {money(currentCart.unit_price)}. Un nouveau formulaire remplacera cette demande.
            </p>
          </div>
          <Link className="btn btn-secondary" href="/profil">
            Voir mon panier
          </Link>
        </div>
      )}

      {availableLicenseTypes.length > 0 && internalEmail && (
        <PilotLicenseForm
          licenseTypes={availableLicenseTypes}
          profileName={profileName}
          profilePhone={profilePhone}
          internalEmail={internalEmail}
        />
      )}

      {availableLicenseTypes.length === 0 && licenseTypes.length > 0 && (
        <div className={styles.error}>
          Aucune licence n’est achetable actuellement pour ton profil. Vérifie ton parcours Academy et l’ouverture des achats ci-dessus.
        </div>
      )}

      {availableLicenseTypes.length > 0 && !internalEmail && (
        <div className={styles.error}>
          La boîte de messagerie interne du citoyen n’a pas pu être récupérée. Ouvre une première fois Profil → Messagerie, puis recharge cette page.
        </div>
      )}

      <section className={styles.steps}>
        <div>
          <span>1</span>
          <strong>Valider la bonne formation</strong>
          <p>La Racing Academy délivre automatiquement la qualification nécessaire après réussite.</p>
        </div>
        <div>
          <span>2</span>
          <strong>Respecter la progression</strong>
          <p>Une licence supérieure peut exiger une licence inférieure encore valide et non suspendue.</p>
        </div>
        <div>
          <span>3</span>
          <strong>Payer depuis le profil</strong>
          <p>Le contrôle est refait au paiement pour empêcher tout contournement avec un ancien panier.</p>
        </div>
      </section>
    </main>
  );
}
