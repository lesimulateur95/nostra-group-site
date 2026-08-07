import Link from "next/link";
import { redirect } from "next/navigation";

import { registerMoneyDrop, withdrawMoneyDropRegistration } from "@/app/actions/money-drop";
import { getMoneyDropPublicState } from "@/lib/money-drop/data";
import styles from "@/components/money-drop/money-drop.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ money_drop_success?: string; money_drop_error?: string }>;
};

export default async function MoneyDropRegistrationPage({ searchParams }: PageProps) {
  const [state, params] = await Promise.all([getMoneyDropPublicState(), searchParams]);
  if (!state.configured || !state.settings.enabled) redirect("/evenements/jeux");

  const error = params.money_drop_error ? decodeURIComponent(params.money_drop_error).toLowerCase() : "";
  const message = error.includes("registration_closed")
    ? "Les inscriptions sont actuellement fermées par la régie."
    : error
      ? "L’inscription n’a pas pu être enregistrée. Réessaie lorsque les inscriptions sont ouvertes."
      : null;

  return (
    <main className={styles.registrationPage}>
      <section className={styles.registrationHero}>
        <span className={styles.broadcastBadge}>JEUX & ÉVÉNEMENTS · MONEY DROP</span>
        <h1>Inscriptions</h1>
        <p>Inscris-toi à la prochaine émission Money Drop. La régie choisit ensuite les participants et compose l’équipe.</p>
      </section>

      {params.money_drop_success === "registered" && <div className={styles.success}>Ton inscription est bien enregistrée.</div>}
      {params.money_drop_success === "registration-withdrawn" && <div className={styles.success}>Ton inscription a été retirée.</div>}
      {message && <div className={styles.error}>{message}</div>}

      <section className={styles.registrationTicket}>
        <div>
          <span className={styles.eyebrow}>ÉTAT DES INSCRIPTIONS</span>
          <strong className={state.settings.public_registration_enabled ? styles.openState : styles.closedState}>
            {state.settings.public_registration_enabled ? "OUVERTES" : "FERMÉES"}
          </strong>
          <p>
            {state.settings.public_registration_enabled
              ? "Tu peux rejoindre la file d’attente. Une inscription ne garantit pas d’être sélectionné pour la prochaine équipe."
              : "La Direction ouvrira les inscriptions avant une prochaine émission."}
          </p>
        </div>

        <div className={styles.registrationActions}>
          {state.current_user_is_registered ? (
            <>
              <div className={styles.registeredStamp}>✓ INSCRIPTION ENREGISTRÉE</div>
              <form action={withdrawMoneyDropRegistration}>
                <button className={styles.secondaryButton} type="submit">Se désinscrire</button>
              </form>
            </>
          ) : (
            <form action={registerMoneyDrop}>
              <button className={styles.primaryButton} type="submit" disabled={!state.settings.public_registration_enabled}>
                S’inscrire à Money Drop
              </button>
            </form>
          )}
          <Link className={styles.secondaryButton} href="/evenements/jeux/money-drop">Retour au jeu</Link>
        </div>
      </section>

      <section className={styles.registrationRules}>
        <article><span>01</span><strong>Inscription</strong><p>Tu entres dans la file d’attente publique depuis cette page.</p></article>
        <article><span>02</span><strong>Sélection</strong><p>La régie sélectionne entre un et quatre citoyens pour composer l’équipe.</p></article>
        <article><span>03</span><strong>Émission</strong><p>Quand la partie démarre, les joueurs répartissent toute la cagnotte sur les trappes.</p></article>
      </section>
    </main>
  );
}
