import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PrintLicenceButton } from "@/components/licenses/print-licence-button";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

import styles from "./print.module.css";

type Licence = {
  id: string;
  holder_name: string;
  holder_email: string | null;
  holder_discord_name: string | null;
  licence_number: string;
  licence_name: string;
  category: string | null;
  authority: string;
  valid_from: string;
  valid_until: string | null;
  permissions: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Sans expiration";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00`));
}

export default async function PrintLicencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const { data: licence, error } = await supabase
    .from("nostra_licences")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !licence) notFound();

  const document = licence as Licence;

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Link href="/dashboard/administration/licences">← Retour au registre</Link>
        <PrintLicenceButton />
      </div>

      <article className={styles.document}>
        <div className={styles.topLine} />
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logo}>N</div>
            <div>
              <small>NOSTRA GROUP</small>
              <h1>LICENCE OFFICIELLE</h1>
              <p>Direction générale · Administration</p>
            </div>
          </div>
          <div className={styles.numberBlock}>
            <small>Numéro officiel</small>
            <strong>{document.licence_number}</strong>
          </div>
        </header>

        <section className={styles.content}>
          <div>
            <div className={styles.holder}>
              <span className={styles.sectionLabel}>Titulaire de la licence</span>
              <h2>{document.holder_name}</h2>
              <p>
                {document.holder_discord_name || document.holder_email || "Citoyen Nostra Group"}
              </p>

              <div className={styles.details}>
                <div className={styles.detail}>
                  <span>Type de licence</span>
                  <strong>{document.licence_name}</strong>
                </div>
                <div className={styles.detail}>
                  <span>Catégorie / niveau</span>
                  <strong>{document.category || "Toutes catégories autorisées"}</strong>
                </div>
                <div className={styles.detail}>
                  <span>Autorité émettrice</span>
                  <strong>{document.authority}</strong>
                </div>
                <div className={styles.detail}>
                  <span>Statut</span>
                  <strong className={styles.status}>{document.status}</strong>
                </div>
              </div>
            </div>

            <div className={styles.signature}>
              <div>Signature du titulaire</div>
              <div>Signature et cachet de la Direction</div>
            </div>
          </div>

          <div className={styles.rightColumn}>
            <div className={styles.validity}>
              <span className={styles.sectionLabel}>Période de validité</span>
              <strong>Du {formatDate(document.valid_from)}</strong>
              <strong>Au {formatDate(document.valid_until)}</strong>
            </div>

            <div className={styles.permissions}>
              <span className={styles.sectionLabel}>Droits et autorisations</span>
              <p>{document.permissions || "Les droits liés à cette licence sont accordés conformément aux règlements Nostra Group en vigueur."}</p>
            </div>

            {document.notes ? (
              <div className={styles.notes}>
                <span className={styles.sectionLabel}>Observations</span>
                <p>{document.notes}</p>
              </div>
            ) : null}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Document généré automatiquement le {formatDate(document.created_at.slice(0, 10))}</span>
          <span>Nostra Group · Licence vérifiable par son numéro unique</span>
        </footer>
      </article>
    </main>
  );
}
