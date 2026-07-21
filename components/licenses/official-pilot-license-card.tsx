import styles from "@/components/licenses/official-pilot-license-card.module.css";

export type OfficialPilotLicensePayload = {
  application_id: number;
  application_number: string;
  license_number: string;
  applicant_name: string;
  phone: string;
  email: string;
  license_code: string;
  license_label: string;
  status: string;
  issued_at: string | null;
  approved_at: string | null;
  season_year: number;
  review_note: string | null;
};

function labelDate(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
  }).format(new Date(value));
}

export function OfficialPilotLicenseCard({
  data,
}: {
  data: OfficialPilotLicensePayload;
}) {
  return (
    <section className={styles.wrapper}>
      <article className={styles.card}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.eyebrow}>
              NOSTRA CIRCUIT · DOCUMENT OFFICIEL
            </span>
            <h2>Licence pilote</h2>
            <p>
              Autorisation officielle délivrée après validation de la
              demande, du paiement et du certificat médical.
            </p>
          </div>

          <div className={styles.badge}>
            <span>NUMÉRO DE LICENCE</span>
            <strong>{data.license_number}</strong>
          </div>
        </header>

        <div className={styles.body}>
          <section className={styles.panel}>
            <div className={styles.identity}>
              <span>PILOTE TITULAIRE</span>
              <h3>{data.applicant_name}</h3>
              <p>{data.license_label}</p>
            </div>

            <div className={styles.panelDetails}>
              <div>
                <span>CATÉGORIE</span>
                <strong>
                  {data.license_code || data.license_label}
                </strong>
              </div>

              <div>
                <span>STATUT</span>
                <strong className={styles.statusActive}>
                  {data.status === "approved"
                    ? "Active"
                    : "Émise"}
                </strong>
              </div>

              <div>
                <span>MESSAGERIE INTERNE</span>
                <strong>{data.email}</strong>
              </div>

              <div>
                <span>TÉLÉPHONE</span>
                <strong>{data.phone}</strong>
              </div>
            </div>
          </section>

          <aside className={styles.metaGrid}>
            <div>
              <span>DEMANDE VALIDÉE</span>
              <strong>{data.application_number}</strong>
            </div>

            <div>
              <span>DATE D’ÉMISSION</span>
              <strong>{labelDate(data.issued_at)}</strong>
            </div>

            <div>
              <span>DATE D’ACCEPTATION</span>
              <strong>{labelDate(data.approved_at)}</strong>
            </div>

            <div>
              <span>SAISON</span>
              <strong>{data.season_year}</strong>
            </div>
          </aside>
        </div>
      </article>

      {data.review_note && (
        <div className={styles.note}>
          <span className={styles.eyebrow}>MESSAGE DE LA DIRECTION</span>
          <div>{data.review_note}</div>
        </div>
      )}

      <section className={styles.footer}>
        <div className={styles.footerBlock}>
          <span>VALIDATION</span>
          <strong>Nostra Circuit · Administration sportive</strong>
          <div className={styles.legend}>
            Cette licence est générée automatiquement par le site après
            validation du dossier par la Direction.
          </div>
        </div>

        <div className={styles.footerBlock}>
          <span>UTILISATION</span>
          <strong>Présentation possible lors des contrôles</strong>
          <div className={styles.legend}>
            Le titulaire doit être en mesure de présenter cette licence
            ainsi qu’un document d’identité si nécessaire.
          </div>
        </div>

        <div className={styles.footerBlock}>
          <span>RÉFÉRENCE</span>
          <strong>{data.license_number}</strong>
          <div className={styles.legend}>
            Bell-Île-en-Mer · Saison {data.season_year}
          </div>
        </div>
      </section>
    </section>
  );
}
