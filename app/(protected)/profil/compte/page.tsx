import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountForm } from "@/components/profile/delete-account-form";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ProfileAccountPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const params = await searchParams;

  return (
    <article className="profile-subpage">
      <header className="document-hero">
        <p className="eyebrow">ESPACE PERSONNEL</p>
        <h1 className="page-title">Paramètres du compte</h1>
        <p className="lead">
          Gère les actions sensibles liées à ton compte Nostra Group.
        </p>
      </header>

      <Link className="btn btn-secondary" href="/profil">
        Retour au profil
      </Link>

      <section className={styles.dangerZone}>
        <div className={styles.dangerHeading}>
          <span>ZONE SENSIBLE</span>
          <h2>Supprimer mon compte</h2>
          <p>
            La suppression coupe définitivement l'accès au compte, retire ton
            profil citoyen, tes licences, ton parcours Academy et les données
            personnelles utilisées par les fonctionnalités du site.
          </p>
        </div>

        <div className={styles.noticeGrid}>
          <div>
            <strong>Ce qui disparaît</strong>
            <p>
              Profil citoyen, favoris, notifications, badges, cartes de fidélité,
              paniers, inscriptions en attente, qualifications et licences liées
              au compte.
            </p>
          </div>
          <div>
            <strong>Ce qui peut rester anonymisé</strong>
            <p>
              Les anciennes écritures comptables, commandes, factures ou contrats
              nécessaires à l'historique de Nostra Group peuvent conserver un
              identifiant technique sans ton profil personnel.
            </p>
          </div>
        </div>

        {params.error === "confirmation" && (
          <div className={styles.errorBox}>
            La confirmation est incomplète. Coche la case et écris exactement
            « SUPPRIMER MON COMPTE ».
          </div>
        )}

        {params.error === "delete_failed" && (
          <div className={styles.errorBox}>
            La suppression n'a pas pu être terminée. Aucun nouvel essai ne sera
            effectué automatiquement : recharge la page puis réessaie.
          </div>
        )}

        <DeleteAccountForm />
      </section>
    </article>
  );
}
