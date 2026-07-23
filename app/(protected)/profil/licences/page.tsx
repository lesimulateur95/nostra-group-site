import Link from "next/link";
import { redirect } from "next/navigation";

import { getOwnOfficialPilotLicences } from "@/lib/licenses/lifecycle";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null): string {
  if (!value) return "Non définie";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function remainingText(days: number | null): string {
  if (days === null) return "Validité en cours";
  if (days < 0) return `Expirée depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
  if (days === 0) return "Expire aujourd’hui";
  if (days === 1) return "Expire demain";
  return `${days} jours restants`;
}

export default async function MyLicencesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const licences = await getOwnOfficialPilotLicences(data.user.id);
  const scheduledNames = new Set(
    licences
      .filter((licence) => licence.lifecycle.status === "upcoming")
      .map((licence) => licence.licence_name.trim().toLowerCase()),
  );

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/profil">← Retour au profil</Link>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/profil/discipline">
            Dossier disciplinaire
          </Link>
          <Link
            className="btn btn-secondary"
            href="/circuit/administration-sportive/payer-ma-licence"
          >
            Demander une licence
          </Link>
        </div>
      </div>

      <header className={styles.hero}>
        <span>ESPACE PILOTE</span>
        <h1>Mes licences</h1>
        <p>
          Consulte leur période de validité, leur solde de points, les
          suspensions éventuelles et lance un renouvellement sans perdre les
          jours restants.
        </p>
      </header>

      {licences.length === 0 ? (
        <section className={styles.empty}>
          <strong>Aucune licence officielle pour le moment</strong>
          <p>
            Une licence apparaîtra ici dès que la Direction du Nostra Circuit
            aura validé ta demande.
          </p>
          <Link
            className="btn btn-primary"
            href="/circuit/administration-sportive/payer-ma-licence"
          >
            Faire une demande
          </Link>
        </section>
      ) : (
        <section className={styles.grid}>
          {licences.map((licence) => {
            const hasScheduledRenewal =
              licence.lifecycle.status !== "upcoming" &&
              scheduledNames.has(licence.licence_name.trim().toLowerCase());
            const canRenew =
              licence.lifecycle.canRenew &&
              !hasScheduledRenewal &&
              Boolean(licence.renewalLicenseCode);

            return (
              <article className={styles.card} key={licence.id}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.number}>
                      {licence.licence_number}
                    </span>
                    <h2>{licence.licence_name}</h2>
                  </div>
                  <span
                    className={`${styles.status} ${styles[licence.lifecycle.status] ?? ""}`}
                    style={
                      licence.lifecycle.status === "suspended"
                        ? {
                            color: "#ff9d9d",
                            borderColor: "rgba(226,74,74,.45)",
                            background: "rgba(226,74,74,.1)",
                          }
                        : undefined
                    }
                  >
                    {licence.lifecycle.label}
                  </span>
                </div>

                <div className={styles.dates}>
                  <div>
                    <span>Début de validité</span>
                    <strong>{formatDate(licence.valid_from)}</strong>
                  </div>
                  <div>
                    <span>Date d’expiration</span>
                    <strong>{formatDate(licence.valid_until)}</strong>
                  </div>
                </div>

                <div className={styles.remaining}>
                  {licence.lifecycle.status === "suspended"
                    ? `Suspendue jusqu’au ${formatDate(licence.discipline.suspensionEndsOn)}`
                    : remainingText(licence.lifecycle.daysRemaining)}
                </div>

                <div className={styles.remaining}>
                  Solde disciplinaire : {licence.discipline.pointsRemaining}/12 points
                </div>

                {hasScheduledRenewal ? (
                  <p className={styles.scheduledNotice}>
                    Un renouvellement est déjà programmé pour cette licence.
                  </p>
                ) : null}

                <div className={styles.actions}>
                  <Link
                    className="btn btn-secondary"
                    href={`/profil/licences/${licence.id}`}
                  >
                    Voir la licence
                  </Link>

                  {canRenew ? (
                    <Link
                      className="btn btn-primary"
                      href="/circuit/administration-sportive/payer-ma-licence"
                    >
                      Renouveler
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className={styles.info}>
        <strong>Fonctionnement du renouvellement</strong>
        <p>
          Une licence est valable cinq mois. Le renouvellement devient
          disponible 60 jours avant son expiration. Une licence temporairement
          suspendue reste enregistrée, mais ses droits circuit sont bloqués
          jusqu’à la fin de la suspension.
        </p>
      </section>
    </main>
  );
}
