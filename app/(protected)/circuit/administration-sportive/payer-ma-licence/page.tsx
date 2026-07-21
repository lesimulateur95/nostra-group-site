import Link from "next/link";
import { redirect } from "next/navigation";

import { PilotLicenseForm } from "@/components/circuit/pilot-license-form";
import {
  getOwnPilotLicenseCart,
  getPilotLicenseTypes,
} from "@/lib/licenses/data";
import { getRpName } from "@/lib/auth/user-profile";
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

export default async function PayPilotLicensePage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const [licenseTypes, currentCart, profileResult, params] =
    await Promise.all([
      getPilotLicenseTypes(),
      getOwnPilotLicenseCart(authData.user.id),
      (supabase as any)
        .from("member_profiles")
        .select("rp_first_name,rp_last_name,phone")
        .eq("user_id", authData.user.id)
        .maybeSingle(),
      searchParams,
    ]);

  const metadata = authData.user.user_metadata ?? {};
  const profile = profileResult.data ?? {};

  const profileName =
    [
      typeof profile.rp_first_name === "string"
        ? profile.rp_first_name
        : "",
      typeof profile.rp_last_name === "string"
        ? profile.rp_last_name
        : "",
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

  const profileEmail = authData.user.email ?? "";

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
              : params.error === "setup"
                ? "Le module des licences pilotes doit d’abord être activé avec le SQL V44."
                : params.error
                  ? "La demande n’a pas pu être ajoutée au panier."
                  : null;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA CIRCUIT</span>
        <h1>Payer ma licence</h1>
        <p>
          Complète ton dossier, joins ton certificat médical puis ajoute
          la licence à ton panier. Le paiement s’effectue ensuite depuis
          ton profil.
        </p>
      </section>

      <section className={styles.prices}>
        {licenseTypes.map((license) => (
          <article key={license.code}>
            <span>{license.code}</span>
            <strong>{license.label}</strong>
            <b>{money(license.price)}</b>
          </article>
        ))}
      </section>

      {licenseTypes.length === 0 && (
        <div className={styles.error}>
          Le module n’est pas encore configuré. Exécute le SQL V44 avant
          d’utiliser cette page.
        </div>
      )}

      {errorMessage && (
        <div className={styles.error}>{errorMessage}</div>
      )}

      {currentCart && (
        <div className={styles.cartNotice}>
          <div>
            <strong>Une demande est déjà dans ton panier</strong>
            <p>
              {currentCart.license_label} —{" "}
              {money(currentCart.unit_price)}. Un nouveau formulaire
              remplacera cette demande.
            </p>
          </div>

          <Link className="btn btn-secondary" href="/profil">
            Voir mon panier
          </Link>
        </div>
      )}

      {licenseTypes.length > 0 && (
        <PilotLicenseForm
          licenseTypes={licenseTypes}
          profileName={profileName}
          profilePhone={profilePhone}
          profileEmail={profileEmail}
        />
      )}

      <section className={styles.steps}>
        <div>
          <span>1</span>
          <strong>Remplir le dossier</strong>
          <p>
            Le bouton de préremplissage récupère les informations
            disponibles dans ton profil.
          </p>
        </div>

        <div>
          <span>2</span>
          <strong>Joindre le certificat</strong>
          <p>
            Le certificat médical est obligatoire avant l’ajout au
            panier.
          </p>
        </div>

        <div>
          <span>3</span>
          <strong>Payer depuis le profil</strong>
          <p>
            Après paiement, la demande apparaît dans Documents &
            factures et la transaction est enregistrée en comptabilité.
          </p>
        </div>
      </section>
    </main>
  );
}
