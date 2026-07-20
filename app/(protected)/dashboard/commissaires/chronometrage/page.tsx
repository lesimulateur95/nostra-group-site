
import Link from "next/link";
import { redirect } from "next/navigation";
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
  searchParams: Promise<{ error?: string }>;
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
  const configured = await getRaceControlModuleConfigured();
  const state = configured
    ? await getRaceControlDashboardState()
    : { configured: false, events: [] };

  return (
    <DashboardShell>
      <main className="dashboard-stack">
        <header className="dashboard-page-header">
          <div>
            <span className="eyebrow">DIRECTION DE COURSE</span>
            <h1>Chronométrage et tours</h1>
            <p>
              Prépare la grille de départ, lance tous les
              chronomètres et enregistre chaque passage sur la ligne.
            </p>
          </div>
          <Link className="btn btn-secondary" href="/dashboard">
            ← Retour au Dashboard
          </Link>
        </header>

        {!configured && (
          <section className="dashboard-setup">
            <span className="module-status">
              Activation V37 nécessaire
            </span>
            <h2>Activer le chronométrage en base de données</h2>
            <p>
              Copie tout le SQL ci-dessous dans Supabase → SQL Editor
              → New query, puis clique sur Run.
            </p>
            <details>
              <summary>Afficher le SQL V37</summary>
              <pre>{RACE_CONTROL_SETUP_SQL}</pre>
            </details>
          </section>
        )}

        {params.error && (
          <div className="dashboard-feedback dashboard-feedback-error">
            {params.error === "entries"
              ? "Ajoute au moins un pilote avec son écurie."
              : "La course n’a pas pu être créée. Vérifie les informations."}
          </div>
        )}

        {configured && (
          <>
            <RaceEventSetup />

            <section className="backoffice-panel">
              <div className="panel-heading">
                <span className="panel-icon">🏁</span>
                <div>
                  <h2>Courses enregistrées</h2>
                  <p>
                    Retrouve les courses en préparation, en direct et
                    déjà publiées.
                  </p>
                </div>
              </div>

              <div className="dashboard-module-grid dashboard-module-grid-two">
                {state.events.length === 0 && (
                  <p className="commerce-hint">
                    Aucune course n’a encore été créée.
                  </p>
                )}

                {state.events.map((event) => (
                  <Link
                    className="dashboard-card"
                    href={`/dashboard/commissaires/chronometrage/${event.id}`}
                    key={event.id}
                  >
                    <span className="dashboard-card-icon">⏱️</span>
                    <span className="dashboard-card-content">
                      <strong>{event.title}</strong>
                      <small>
                        {competitionLabels[event.competition_type]} ·{" "}
                        {event.target_laps} tour(s) ·{" "}
                        {event.participant_count} pilote(s)
                      </small>
                      <small>
                        {statusLabels[event.status] ?? event.status}
                        {event.active_count > 0
                          ? ` · ${event.active_count} encore en piste`
                          : ""}
                      </small>
                    </span>
                    <span className="dashboard-card-arrow">→</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
