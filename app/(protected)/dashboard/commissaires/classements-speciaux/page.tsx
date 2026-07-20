
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addCircuitLapRecord,
  addEventRankingResult,
  addTimeTrialResult,
  deleteSpecialRankingEntry,
  resetSpecialRanking,
} from "@/app/actions/special-rankings";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { formatRankingTime } from "@/components/special-rankings/public-special-rankings";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getSpecialRankingsConfigured,
  getSpecialRankingsDashboardState,
} from "@/lib/special-rankings/data";
import { SPECIAL_RANKINGS_SETUP_SQL } from "@/lib/special-rankings/setup-sql";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/special-rankings/special-rankings.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());
}

export default async function SpecialRankingsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    added?: string;
    deleted?: string;
    reset?: string;
    error?: string;
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

  const params = await searchParams;
  const configured = await getSpecialRankingsConfigured();
  const state = configured
    ? await getSpecialRankingsDashboardState()
    : {
        configured: false,
        event_scores: [],
        time_trials: [],
        lap_records: [],
      };

  return (
    <DashboardShell>
      <main className="dashboard-stack">
        <header className="dashboard-page-header">
          <div>
            <span className="eyebrow">COMMISSAIRES</span>
            <h1>Classements spéciaux</h1>
            <p>
              Alimenter les classements événements, contre-la-montre
              et records du tour du Nostra Circuit.
            </p>
          </div>

          <Link className="btn btn-secondary" href="/dashboard">
            ← Retour au Dashboard
          </Link>
        </header>

        {!configured && (
          <section className="dashboard-setup">
            <span className="module-status">
              Activation V38 nécessaire
            </span>
            <h2>Activer les nouveaux classements</h2>
            <p>
              Copie tout le SQL ci-dessous dans Supabase → SQL Editor
              → New query, puis clique sur Run.
            </p>
            <details>
              <summary>Afficher le SQL V38</summary>
              <pre>{SPECIAL_RANKINGS_SETUP_SQL}</pre>
            </details>
          </section>
        )}

        {params.added && (
          <div className="dashboard-feedback dashboard-feedback-success">
            Le résultat a été ajouté au classement.
          </div>
        )}

        {params.deleted && (
          <div className="dashboard-feedback dashboard-feedback-success">
            Le résultat a été supprimé.
          </div>
        )}

        {params.reset && (
          <div className="dashboard-feedback dashboard-feedback-success">
            Le classement sélectionné a été réinitialisé.
          </div>
        )}

        {params.error && (
          <div className="dashboard-feedback dashboard-feedback-error">
            {params.error === "event"
              ? "Vérifie le résultat de l’événement."
              : params.error === "time_trial" ||
                  params.error === "lap_record"
                ? "Vérifie le chrono. Formats acceptés : 1:23.456 ou 83.456."
                : params.error === "reset"
                  ? "Coche la confirmation avant la réinitialisation."
                  : "L’action n’a pas pu être enregistrée."}
          </div>
        )}

        {configured && (
          <>
            <section className={styles.dashboardGrid}>
              <article className={styles.managementPanel}>
                <header>
                  <span className={styles.sectionLabel}>
                    CLASSEMENT ÉVÉNEMENTS
                  </span>
                  <h2>Ajouter un résultat</h2>
                  <p>
                    Les points sont cumulés automatiquement par pilote.
                  </p>
                </header>

                <form
                  action={addEventRankingResult}
                  className={styles.form}
                >
                  <label>
                    Événement
                    <input
                      name="event_name"
                      maxLength={160}
                      required
                      placeholder="Exemple : Course des entreprises"
                    />
                  </label>

                  <div className={styles.rowTwo}>
                    <label>
                      Pilote
                      <input
                        name="driver_name"
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Écurie
                      <input
                        name="team_name"
                        maxLength={120}
                        required
                      />
                    </label>
                  </div>

                  <div className={styles.rowTwo}>
                    <label>
                      Position
                      <input
                        type="number"
                        name="finishing_position"
                        min={1}
                        required
                      />
                    </label>
                    <label>
                      Points
                      <input
                        type="number"
                        name="points"
                        min={0}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Date
                    <input
                      type="date"
                      name="event_date"
                      defaultValue={today()}
                      required
                    />
                  </label>

                  <label>
                    Note facultative
                    <textarea name="note" rows={2} maxLength={500} />
                  </label>

                  <button
                    className={styles.primaryButton}
                    type="submit"
                  >
                    Ajouter au classement événements
                  </button>
                </form>

                <div className={styles.records}>
                  {state.event_scores.map((record) => (
                    <article
                      className={styles.recordRow}
                      key={record.id}
                    >
                      <div>
                        <strong>
                          {record.finishing_position}.{" "}
                          {record.driver_name} — {record.points} pts
                        </strong>
                        <span>
                          {record.event_name} · {record.team_name}
                        </span>
                      </div>
                      <form action={deleteSpecialRankingEntry}>
                        <input
                          type="hidden"
                          name="record_type"
                          value="event"
                        />
                        <input
                          type="hidden"
                          name="record_id"
                          value={record.id}
                        />
                        <button
                          className={styles.deleteButton}
                          type="submit"
                        >
                          Supprimer
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              </article>

              <article className={styles.managementPanel}>
                <header>
                  <span className={styles.sectionLabel}>
                    CONTRE-LA-MONTRE
                  </span>
                  <h2>Ajouter un chrono</h2>
                  <p>
                    Le site trie automatiquement du temps le plus
                    rapide au plus lent.
                  </p>
                </header>

                <form
                  action={addTimeTrialResult}
                  className={styles.form}
                >
                  <label>
                    Parcours
                    <input
                      name="course_name"
                      maxLength={160}
                      required
                      placeholder="Exemple : Boucle extérieure"
                    />
                  </label>

                  <div className={styles.rowTwo}>
                    <label>
                      Pilote
                      <input
                        name="driver_name"
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Écurie
                      <input
                        name="team_name"
                        maxLength={120}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Véhicule
                    <input
                      name="vehicle_name"
                      maxLength={160}
                      required
                    />
                  </label>

                  <div className={styles.rowTwo}>
                    <label>
                      Chrono
                      <input
                        name="time_text"
                        maxLength={30}
                        required
                        placeholder="1:23.456"
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        name="attempt_date"
                        defaultValue={today()}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Note facultative
                    <textarea name="note" rows={2} maxLength={500} />
                  </label>

                  <button
                    className={styles.primaryButton}
                    type="submit"
                  >
                    Ajouter au contre-la-montre
                  </button>
                </form>

                <div className={styles.records}>
                  {state.time_trials.map((record) => (
                    <article
                      className={styles.recordRow}
                      key={record.id}
                    >
                      <div>
                        <strong>
                          {formatRankingTime(record.time_ms)} —{" "}
                          {record.driver_name}
                        </strong>
                        <span>
                          {record.course_name} · {record.vehicle_name}
                        </span>
                      </div>
                      <form action={deleteSpecialRankingEntry}>
                        <input
                          type="hidden"
                          name="record_type"
                          value="time_trial"
                        />
                        <input
                          type="hidden"
                          name="record_id"
                          value={record.id}
                        />
                        <button
                          className={styles.deleteButton}
                          type="submit"
                        >
                          Supprimer
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              </article>

              <article className={styles.managementPanel}>
                <header>
                  <span className={styles.sectionLabel}>
                    RECORD TOUR CIRCUIT
                  </span>
                  <h2>Homologuer un tour</h2>
                  <p>
                    Le meilleur chrono devient automatiquement le
                    record officiel du tracé.
                  </p>
                </header>

                <form
                  action={addCircuitLapRecord}
                  className={styles.form}
                >
                  <label>
                    Tracé du circuit
                    <input
                      name="circuit_layout"
                      maxLength={160}
                      required
                      placeholder="Exemple : Grand tracé"
                    />
                  </label>

                  <div className={styles.rowTwo}>
                    <label>
                      Pilote
                      <input
                        name="driver_name"
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Écurie
                      <input
                        name="team_name"
                        maxLength={120}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Véhicule
                    <input
                      name="vehicle_name"
                      maxLength={160}
                      required
                    />
                  </label>

                  <div className={styles.rowTwo}>
                    <label>
                      Temps du tour
                      <input
                        name="time_text"
                        maxLength={30}
                        required
                        placeholder="1:08.742"
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        name="record_date"
                        defaultValue={today()}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Note facultative
                    <textarea name="note" rows={2} maxLength={500} />
                  </label>

                  <button
                    className={styles.primaryButton}
                    type="submit"
                  >
                    Homologuer le temps du tour
                  </button>
                </form>

                <div className={styles.records}>
                  {state.lap_records.map((record) => (
                    <article
                      className={styles.recordRow}
                      key={record.id}
                    >
                      <div>
                        <strong>
                          {formatRankingTime(record.lap_time_ms)} —{" "}
                          {record.driver_name}
                        </strong>
                        <span>
                          {record.circuit_layout} ·{" "}
                          {record.vehicle_name}
                        </span>
                      </div>
                      <form action={deleteSpecialRankingEntry}>
                        <input
                          type="hidden"
                          name="record_type"
                          value="lap_record"
                        />
                        <input
                          type="hidden"
                          name="record_id"
                          value={record.id}
                        />
                        <button
                          className={styles.deleteButton}
                          type="submit"
                        >
                          Supprimer
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              </article>
            </section>

            <section className={styles.resetPanel}>
              <div>
                <span className={styles.sectionLabel}>
                  REMISE À ZÉRO
                </span>
                <h2>Réinitialiser un classement spécial</h2>
                <p>
                  Cette action supprime définitivement les résultats
                  de la catégorie sélectionnée.
                </p>
              </div>

              <form
                action={resetSpecialRanking}
                className={styles.resetForm}
              >
                <label>
                  Classement
                  <select name="scope" defaultValue="event">
                    <option value="event">
                      Classement événements
                    </option>
                    <option value="time_trial">
                      Chrono contre la montre
                    </option>
                    <option value="lap_record">
                      Records du tour
                    </option>
                    <option value="all">
                      Les trois classements
                    </option>
                  </select>
                </label>

                <label className={styles.confirm}>
                  <input
                    type="checkbox"
                    name="confirmed"
                    value="yes"
                    required
                  />
                  <span>
                    Je confirme la suppression des résultats de cette
                    catégorie.
                  </span>
                </label>

                <button
                  className={styles.resetButton}
                  type="submit"
                >
                  Réinitialiser
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
