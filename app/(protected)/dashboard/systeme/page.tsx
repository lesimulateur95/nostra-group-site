import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getNostraEnvironment } from "@/lib/system/environment";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckState = {
  label: string;
  status: "success" | "warning" | "error";
  message: string;
};

async function databaseCheck(
  table: string,
): Promise<CheckState> {
  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from(table)
    .select("*", {
      count: "exact",
      head: true,
    });

  if (!error) {
    return {
      label: table,
      status: "success",
      message: "Accessible",
    };
  }

  return {
    label: table,
    status: "warning",
    message:
      error.code === "42P01"
        ? "Table absente"
        : error.message,
  };
}

export default async function SystemDashboardPage() {
  const supabase = await createClient();
  const { data } =
    await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles =
    await getUserRoleKeys(data.user);

  if (!roles.includes("manager")) {
    redirect("/accueil");
  }

  const environment =
    getNostraEnvironment();

  const checks = await Promise.all([
    databaseCheck("member_profiles"),
    databaseCheck("orders"),
    databaseCheck("user_notifications"),
  ]);

  const environmentCheck: CheckState = {
    label: "Correspondance des environnements",
    status: environment.hasEnvironmentMismatch
      ? "error"
      : "success",
    message:
      environment.hasEnvironmentMismatch
        ? `Site ${environment.environment} connecté à une base ${environment.dataEnvironment ?? "non définie"}.`
        : "Le site et la base déclarent le même environnement.",
  };

  const supabaseCheck: CheckState = {
    label: "Variables Supabase",
    status:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? "success"
        : "error",
    message:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? "URL et clé publique présentes."
        : "Une variable Supabase obligatoire manque.",
  };

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <span>
            DIRECTION · CONTRÔLE DES DÉPLOIEMENTS
          </span>

          <h1>
            Préproduction et retour arrière
          </h1>

          <p>
            Vérifie exactement quelle version est ouverte avant
            d’autoriser son passage sur le site officiel.
          </p>
        </section>

        <section className={styles.release}>
          <div>
            <span>ENVIRONNEMENT ACTUEL</span>
            <strong>{environment.label}</strong>
          </div>

          <div>
            <span>BRANCHE GITHUB</span>
            <strong>{environment.branch}</strong>
          </div>

          <div>
            <span>COMMIT</span>
            <strong>
              {environment.shortCommitSha}
            </strong>
          </div>

          <div>
            <span>VERSION</span>
            <strong>{environment.releaseName}</strong>
          </div>
        </section>

        <section className={styles.section}>
          <header>
            <span>DIAGNOSTIC</span>
            <h2>État de la version</h2>
          </header>

          <div className={styles.checks}>
            {[environmentCheck, supabaseCheck, ...checks].map(
              (check) => (
                <article
                  className={`${styles.check} ${
                    styles[check.status]
                  }`}
                  key={check.label}
                >
                  <span>
                    {check.status === "success"
                      ? "✓"
                      : check.status === "warning"
                        ? "!"
                        : "×"}
                  </span>

                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.message}</p>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section className={styles.section}>
          <header>
            <span>PUBLICATION</span>
            <h2>
              Procédure avant la production
            </h2>
          </header>

          <ol className={styles.steps}>
            <li>
              Envoyer les nouveautés sur la branche{" "}
              <code>staging</code>.
            </li>
            <li>
              Attendre que Vercel affiche{" "}
              <strong>Ready</strong>.
            </li>
            <li>
              Tester la connexion, le profil, le Dashboard, une
              commande et les fonctionnalités modifiées.
            </li>
            <li>
              Ouvrir{" "}
              <code>/api/health</code> et vérifier le statut{" "}
              <strong>ok</strong>.
            </li>
            <li>
              Fusionner seulement ensuite{" "}
              <code>staging</code> vers{" "}
              <code>main</code>.
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <header>
            <span>URGENCE</span>
            <h2>
              Retour à la dernière version fonctionnelle
            </h2>
          </header>

          <div className={styles.rollback}>
            <div>
              <strong>
                Depuis le Dashboard Vercel
              </strong>
              <p>
                Ouvre le projet, sélectionne le déploiement de
                production puis utilise <b>Instant Rollback</b>.
              </p>
            </div>

            <div>
              <strong>
                Depuis la liste des déploiements
              </strong>
              <p>
                Ouvre une ancienne version fonctionnelle et
                réassigne-la à la production.
              </p>
            </div>

            <div>
              <strong>
                Base de données
              </strong>
              <p>
                Un retour du code ne supprime pas automatiquement
                les changements SQL. Les migrations destructives
                doivent avoir leur propre script de retour.
              </p>
            </div>
          </div>

          <div className={styles.links}>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir Vercel ↗
            </a>

            <a
              href="https://github.com/lesimulateur95/nostra-group-site/branches"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir les branches GitHub ↗
            </a>

            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
            >
              Vérifier /api/health ↗
            </a>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
