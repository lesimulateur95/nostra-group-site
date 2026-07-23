import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getOwnCircuitDisciplineData,
  type CircuitDisciplinaryAction,
  type DisciplineActionType,
} from "@/lib/discipline/data";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTION_LABELS: Record<DisciplineActionType, string> = {
  warning: "Avertissement",
  penalty: "Pénalité",
  suspension: "Suspension temporaire",
  points_deduction: "Retrait de points",
};

function formatDate(value: string | null): string {
  if (!value) return "Non définie";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function actionDetail(action: CircuitDisciplinaryAction): string {
  if (action.actionType === "points_deduction") {
    return `${action.pointsRemoved} point${action.pointsRemoved > 1 ? "s" : ""} retiré${action.pointsRemoved > 1 ? "s" : ""}`;
  }
  if (action.actionType === "penalty" && action.penaltyAmount > 0) {
    return `${action.penaltyAmount.toLocaleString("fr-FR")} €`;
  }
  if (action.actionType === "suspension") {
    return `Du ${formatDate(action.suspensionStartsOn)} au ${formatDate(action.suspensionEndsOn)} inclus`;
  }
  return "Avertissement inscrit au dossier";
}

export default async function MyCircuitDisciplinePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const discipline = await getOwnCircuitDisciplineData(data.user.id);

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/profil">← Retour au profil</Link>
        <Link href="/profil/licences" className="btn btn-secondary">
          Mes licences
        </Link>
      </div>

      <header className={styles.hero}>
        <span>ESPACE PILOTE · NOSTRA CIRCUIT</span>
        <h1>Mon dossier disciplinaire</h1>
        <p>
          Consulte les décisions officielles liées à tes licences, ton solde de
          points et les éventuelles périodes de suspension.
        </p>
      </header>

      {!discipline.configured ? (
        <section className={styles.empty}>
          <strong>Module disciplinaire non disponible</strong>
          <p>La Direction doit d’abord activer le SQL V62.</p>
        </section>
      ) : (
        <>
          <section className={styles.licenceGrid}>
            {discipline.licences.map((licence) => (
              <article className={styles.licenceCard} key={licence.id}>
                <div className={styles.licenceTop}>
                  <div>
                    <span>{licence.licenceNumber}</span>
                    <h2>{licence.licenceName}</h2>
                  </div>
                  <strong
                    className={
                      licence.pointsRemaining <= 3
                        ? styles.dangerPoints
                        : styles.points
                    }
                  >
                    {licence.pointsRemaining}/12 points
                  </strong>
                </div>

                {licence.currentSuspension ? (
                  <div className={styles.suspension}>
                    <b>Licence suspendue</b>
                    <span>
                      Jusqu’au {formatDate(licence.currentSuspension.suspensionEndsOn)} inclus
                    </span>
                    <small>{licence.currentSuspension.reason}</small>
                  </div>
                ) : (
                  <div className={styles.available}>Licence non suspendue</div>
                )}

                <p>
                  {licence.pointsRemoved} point(s) retiré(s) · {licence.activeActions} mesure(s) active(s)
                </p>
              </article>
            ))}
          </section>

          <section className={styles.panel}>
            <div className={styles.heading}>
              <div>
                <span>HISTORIQUE OFFICIEL</span>
                <h2>Décisions enregistrées</h2>
              </div>
              <p>{discipline.actions.length} mesure(s) dans ton dossier.</p>
            </div>

            {discipline.actions.length === 0 ? (
              <div className={styles.empty}>
                <strong>Aucune mesure disciplinaire</strong>
                <p>Ton dossier ne contient aucun avertissement ni sanction.</p>
              </div>
            ) : (
              <div className={styles.list}>
                {discipline.actions.map((action) => (
                  <article className={styles.action} key={action.id}>
                    <div className={styles.actionHeader}>
                      <div>
                        <span>{action.caseNumber}</span>
                        <h3>{ACTION_LABELS[action.actionType]}</h3>
                        <p>{action.licenceNumber} · {action.licenceName}</p>
                      </div>
                      <span className={`${styles.status} ${styles[action.status]}`}>
                        {action.status === "active"
                          ? "Active"
                          : action.status === "completed"
                            ? "Clôturée"
                            : "Annulée"}
                      </span>
                    </div>

                    <div className={styles.details}>
                      <div>
                        <span>Motif</span>
                        <strong>{action.reason}</strong>
                      </div>
                      <div>
                        <span>Mesure</span>
                        <strong>{actionDetail(action)}</strong>
                      </div>
                      <div>
                        <span>Décision du</span>
                        <strong>{formatDateTime(action.issuedAt)}</strong>
                      </div>
                      <div>
                        <span>Autorité</span>
                        <strong>{action.issuedByName}</strong>
                      </div>
                    </div>

                    {action.eventName ? (
                      <p className={styles.note}><b>Événement :</b> {action.eventName}</p>
                    ) : null}
                    {action.note ? (
                      <p className={styles.note}><b>Observations :</b> {action.note}</p>
                    ) : null}
                    {action.cancellationReason ? (
                      <p className={styles.cancelledNote}>
                        <b>Mesure annulée :</b> {action.cancellationReason}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className={styles.info}>
        <strong>Important</strong>
        <p>
          Une suspension temporaire bloque les droits liés à la licence pendant
          la période indiquée, sans supprimer définitivement la licence. Une
          mesure annulée reste visible dans l’historique pour garantir la
          traçabilité des décisions.
        </p>
      </section>
    </main>
  );
}
