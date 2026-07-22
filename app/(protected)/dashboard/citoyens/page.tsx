import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { citizenDirectory } from "@/lib/operations-v50/data";
import styles from "@/components/operations-v50/operations.module.css";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const citizens = await citizenDirectory(params.q ?? "");

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <Link className={styles.backLink} href="/dashboard">
            ← Retour au Dashboard
          </Link>
          <span>DIRECTION · CENTRE CITOYENS</span>
          <h1>Fiches citoyens centralisées</h1>
          <p>Tous les comptes et leurs informations importantes au même endroit.</p>
          <div className={styles.actions}>
            <Link className={styles.actionLink} href="/dashboard/badges">
              🏅 Gérer les badges & succès
            </Link>
          </div>
        </section>

        <form className={styles.search} method="get">
          <label>
            <span>Recherche</span>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Nom, e-mail, téléphone, rôle ou fidélité"
            />
          </label>
          <button>Rechercher</button>
        </form>

        <section className={styles.section}>
          <header>
            <span>COMPTES</span>
            <h2>{citizens.length} résultat(s)</h2>
          </header>
          <div className={styles.list}>
            {citizens.length === 0 && (
              <div className={styles.empty}>Aucun compte trouvé.</div>
            )}
            {citizens.map((citizen) => (
              <article className={styles.row} key={citizen.user_id}>
                <div>
                  <h3>{citizen.name}</h3>
                  <p>
                    {citizen.email ?? "E-mail non renseigné"}
                    {citizen.phone ? ` · ${citizen.phone}` : ""}
                  </p>
                  <div className={styles.badges}>
                    {(citizen.roles?.length
                      ? citizen.roles
                      : citizen.role
                        ? [citizen.role]
                        : ["Citoyen"]
                    ).map((role: string) => (
                      <span className={styles.badge} key={role}>
                        {role}
                      </span>
                    ))}
                    {citizen.loyalty_tier && (
                      <span className={`${styles.badge} ${styles.green}`}>
                        {citizen.loyalty_tier}
                      </span>
                    )}
                    <span className={styles.badge}>SAV {citizen.sav_count}</span>
                    <span className={styles.badge}>
                      Candidatures {citizen.recruitment_count}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <Link
                    className={styles.actionLink}
                    href={`/dashboard/badges?citoyen=${citizen.user_id}`}
                  >
                    Badges
                  </Link>
                  <Link
                    className={styles.actionLink}
                    href={`/dashboard/citoyens/${citizen.user_id}`}
                  >
                    Ouvrir →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
