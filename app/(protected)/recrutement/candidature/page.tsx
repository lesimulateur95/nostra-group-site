import Link from "next/link";
import { redirect } from "next/navigation";

import { createRecruitment, withdrawRecruitment } from "@/app/actions/operations-v50";
import styles from "@/components/operations-v50/operations.module.css";
import { recruitments } from "@/lib/operations-v50/data";
import { createClient } from "@/lib/supabase/server";
import recruitmentStyles from "../page.module.css";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; withdrawn?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [applications, params] = await Promise.all([
    recruitments(data.user.id),
    searchParams,
  ]);

  return (
    <main className={styles.page}>
      <div className={recruitmentStyles.backHomeWrap}>
        <Link className={recruitmentStyles.backHome} href="/accueil">
          <span aria-hidden="true">←</span>
          Retour à l’accueil
        </Link>
      </div>

      <section className={styles.hero}>
        <span>RECRUTEMENT · NOSTRA GROUP</span>
        <h1>Ma candidature</h1>
        <p>Déposez et suivez vos dossiers.</p>
      </section>

      {params.success && (
        <div className={styles.success}>Candidature {params.success} envoyée.</div>
      )}
      {params.withdrawn && (
        <div className={styles.success}>Candidature retirée.</div>
      )}
      {params.error && (
        <div className={styles.error}>
          {params.error === "file-size"
            ? "Fichier supérieur à 8 Mo."
            : params.error === "file-type"
              ? "PDF, JPG ou PNG uniquement."
              : "Enregistrement impossible."}
        </div>
      )}

      <section className={styles.gridTwo}>
        <form className={styles.form} action={createRecruitment}>
          <label>
            <span>Poste recherché</span>
            <input name="desired_position" required maxLength={180} />
          </label>
          <label>
            <span>Téléphone</span>
            <input name="phone" maxLength={60} />
          </label>
          <label>
            <span>Disponibilités</span>
            <textarea name="availability" required />
          </label>
          <label>
            <span>Expérience</span>
            <textarea name="experience" required minLength={10} />
          </label>
          <label>
            <span>Motivation</span>
            <textarea name="motivation" required minLength={20} />
          </label>
          <label>
            <span>CV ou document (PDF/JPG/PNG, 8 Mo)</span>
            <input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" />
          </label>
          <button className={styles.primary}>Envoyer</button>
        </form>

        <section className={styles.section}>
          <header>
            <span>MES DOSSIERS</span>
            <h2>{applications.length} candidature(s)</h2>
          </header>
          {applications.map((application) => (
            <article className={styles.card} key={application.id}>
              <span>{application.application_number}</span>
              <h3>{application.desired_position}</h3>
              <p>Statut : {application.status}</p>
              {application.manager_message && (
                <div className={styles.warning}>{application.manager_message}</div>
              )}
              {["received", "reviewing"].includes(application.status) && (
                <form action={withdrawRecruitment}>
                  <input type="hidden" name="id" value={application.id} />
                  <button className={styles.danger}>Retirer</button>
                </form>
              )}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
