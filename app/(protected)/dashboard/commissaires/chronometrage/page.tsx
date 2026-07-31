import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteRaceControlEvent,
  resetRaceControlStandings,
} from "@/app/actions/race-control";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RaceEventSetup } from "@/components/race-control/race-event-setup";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getRaceControlDashboardState,
  getRaceControlModuleConfigured,
} from "@/lib/race-control/data";
import { RACE_CONTROL_SETUP_SQL } from "@/lib/race-control/setup-sql";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/race-control/race-control.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  ready: "Grille validée",
  running: "Course en direct",
  finished: "Calcul terminé",
  published: "Résultats publiés",
  cancelled: "Course annulée",
};

const competitionLabels: Record<string, string> = {
  f1: "F1",
  gt3rs: "GT3 RS",
  general: "Course libre",
};

export default async function RaceControlSetupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    reset?: string;
    deleted?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);

  if (
    !roles.includes("manager") &&
    !roles.includes("commissioner")
  ) {
    redirect("/accueil");
  }

  const isManager = roles.includes("manager");
  const basePath = isManager
    ? "/dashboard/commissaires/chronometrage"
    : "/commissaires/chronometrage";
  const backPath = isManager ? "/dashboard" : "/commissaires";
  const backLabel = isManager
    ? "Retour au Dashboard"
    : "Retour à l’espace Commissaire";

  const params = await searchParams;
  const configured = await getRaceControlModuleConfigured();
  const state = configured
    ? await getRaceControlDashboardState()
    : { configured: false, events: [] };

  return (
    <DashboardShell
      allowedRoles={["manager", "commissioner"]}
    >
      <main className="dashboard-stack">
        <header className="dashboard-page-header">
          <div>
            <span className="eyebrow">
              DIRECTION DE COURSE
            </span>
            <h1>Chronométrage et tours</h1>

            <p>
              Prépare la grille de départ, lance tous les
              chronomètres et enregistre chaque passage sur la ligne.
            </p>
          </div>

          <Link
            className="btn btn-secondary"
            href={backPath}
          >
            ← {backLabel}
          </Link>
        </header>

        {!configured && (
          <section className="dashboard-setup">
            <span className="module-status">
              Activation V37 nécessaire
            </span>

            <h2>
              Activer le chronométrage en base de données
            </h2>

            <p>
              Copie tout le SQL ci-dessous dans Supabase → SQL
              Editor → New query, puis clique sur Run.
            </p>

            <details>
              <summary>Afficher le SQL V37</summary>
              <pre>{RACE_CONTROL_SETUP_SQL}</pre>
            </details>
          </section>
        )}

        {params.reset && (
          <div className="dashboard-feedback dashboard-feedback-success">
            {params.reset === "all"
              ? "Tous les classements F1 et GT3 RS ont été réinitialisés."
              : `Le classement ${params.reset.toUpperCase()} a été réinitialisé.`}
            {" "}
            Les courses et tous les chronos restent sauvegardés.
          </div>
        )}

        {params.deleted && (
          <div className="dashboard-feedback dashboard-feedback-success">
            La course et tous ses chronos ont été supprimés.
          </div>
        )}

        {params.error && (
          <div className="dashboard-feedback dashboard-feedback-error">
            {params.error === "entries"
              ? "Ajoute au moins un pilote avec son écurie."
              : params.error === "reset_confirmation"
                ? "Coche la confirmation avant de réinitialiser un classement."
                : "L’action n’a pas pu être enregistrée. Vérifie les informations."}
          </div>
        )}

        {configured && (
          <>
            <RaceEventSetup />

            <section className={styles.resetPanel}>
              <div>
                <span className={styles.sectionLabel}>
                  GESTION DES CLASSEMENTS
                </span>

                <h2>
                  Réinitialiser les classements publiés
                </h2>

                <p>
                  La réinitialisation retire les courses concernées
                  des résultats publics et remet les points à zéro.
                  Les courses, les tours et tous les chronos restent
                  enregistrés dans la base de données.
                </p>
              </div>

              <form
                action={resetRaceControlStandings}
                className={styles.resetForm}
              >
                <label>
                  Classement à réinitialiser
                  <select name="scope" defaultValue="f1">
                    <option value="f1">
                      Championnat F1
                    </option>
                    <option value="gt3rs">
                      Championnat GT3 RS
                    </option>
                    <option value="all">
                      Tous les classements
                    </option>
                  </select>
                </label>

                <label className={styles.resetConfirm}>
                  <input
                    type="checkbox"
                    name="confirmed"
                    value="yes"
                    required
                  />
                  <span>
                    Je confirme la remise à zéro des résultats
                    publiés sélectionnés.
                  </span>
                </label>

                <button
                  className={styles.resetButton}
                  type="submit"
                >
                  Réinitialiser le classement
                </button>
              </form>
            </section>

            <section className="backoffice-panel">
              <div className="panel-heading">
                <span className="panel-icon" />
                <div>
                  <h2>Courses enregistrées</h2>
                  <p>
                    Retrouve les courses en préparation, en direct et
                    déjà publiées.
                  </p>
                </div>
              </div>

              <p className={styles.savedRaceWarning}>
                Le bouton rouge supprime définitivement la course,
                ses pilotes, ses tours et ses chronos. Aucune fenêtre
                de confirmation ne s’ouvrira.
              </p>

              <div className={styles.savedRaceList}>
                {state.events.length === 0 && (
                  <p className="commerce-hint">
                    Aucune course n’a encore été créée.
                  </p>
                )}

                {state.events.map((event) => (
                  <article
                    className={styles.savedRaceRow}
                    key={event.id}
                  >
                    <Link
                      className={`dashboard-card ${styles.savedRaceLink}`}
                      href={`${basePath}/${event.id}`}
                    >
                      <span className="dashboard-card-icon">
                        ⏱️
                      </span>

                      <span className="dashboard-card-content">
                        <strong>{event.title}</strong>
                        <small>
                          {competitionLabels[
                            event.competition_type
                          ]}{" "}
                          · {event.target_laps} tour(s) ·{" "}
                          {event.participant_count} pilote(s)
                        </small>

                        <small>
                          {statusLabels[event.status] ??
                            event.status}
                          {event.active_count > 0
                            ? ` · ${event.active_count} encore en piste`
                            : ""}
                        </small>
                      </span>

                      <span className="dashboard-card-arrow">
                        →
                      </span>
                    </Link>

                    <form action={deleteRaceControlEvent}>
                      <input
                        type="hidden"
                        name="event_id"
                        value={event.id}
                      />

                      <button
                        className={styles.deleteRaceButton}
                        type="submit"
                      >
                        Supprimer la course
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
