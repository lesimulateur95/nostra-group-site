import Link from "next/link";
import { redirect } from "next/navigation";

import {
  cancelCircuitDisciplinaryAction,
  completeCircuitDisciplinaryAction,
} from "@/app/actions/circuit-discipline";
import { DisciplineForm } from "@/components/discipline/discipline-form";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getCircuitDisciplineDashboardData,
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
  suspension: "Suspension",
  points_deduction: "Retrait de points",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Sélectionne une licence et indique un motif complet.",
  licence: "La licence sélectionnée est introuvable.",
  points: "Le retrait doit être compris entre 1 et 12 points.",
  points_remaining: "Tu ne peux pas retirer plus de points qu’il n’en reste sur cette licence.",
  dates: "Les dates de suspension sont incorrectes.",
  reason: "Le motif doit contenir au moins trois caractères.",
  permission: "Tu ne disposes pas de l’autorisation nécessaire.",
  cancel: "Indique un motif avant d’annuler la mesure.",
  complete: "Impossible de clôturer cette mesure.",
  missing: "La mesure disciplinaire est introuvable.",
  save: "La mesure n’a pas pu être enregistrée. Vérifie le SQL V62.",
};

function formatDate(value: string | null): string {
  if (!value) return "Non définie";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function formatDateTime(value: string): string {
  if (!value) return "Date inconnue";
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
    return `${formatDate(action.suspensionStartsOn)} → ${formatDate(action.suspensionEndsOn)}`;
  }
  return ACTION_LABELS[action.actionType];
}

function isCurrentSuspension(action: CircuitDisciplinaryAction): boolean {
  if (
    action.actionType !== "suspension" ||
    action.status === "cancelled" ||
    !action.suspensionStartsOn ||
    !action.suspensionEndsOn
  ) {
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  return today >= action.suspensionStartsOn && today <= action.suspensionEndsOn;
}

export default async function CircuitDisciplineCommissionersPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    case?: string;
    status?: string;
    type?: string;
    q?: string;
    licence?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const roles = await getUserRoleKeys(authData.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const data = await getCircuitDisciplineDashboardData();

  if (!data.configured) {
    return (
      <main className={styles.page}>
        <Link href="/commissaires" className={styles.backLink}>
          ← Retour à l’espace commissaires
        </Link>
        <section className={styles.setupCard}>
          <span>ACTIVATION REQUISE</span>
          <h1>Gestion disciplinaire Nostra Circuit</h1>
          <p>
            Exécute d’abord le fichier SQL
            <strong> supabase/gestion-disciplinaire-circuit-v62.sql</strong>,
            puis recharge cette page avec Ctrl + F5.
          </p>
        </section>
      </main>
    );
  }

  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status ?? "all";
  const typeFilter = params.type ?? "all";

  const filteredActions = data.actions.filter((action) => {
    const statusMatches =
      statusFilter === "all" || action.status === statusFilter;
    const typeMatches =
      typeFilter === "all" || action.actionType === typeFilter;
    const queryMatches =
      !query ||
      `${action.holderName} ${action.licenceNumber} ${action.caseNumber} ${action.reason}`
        .toLowerCase()
        .includes(query);
    return statusMatches && typeMatches && queryMatches;
  });

  const activeWarnings = data.actions.filter(
    (action) => action.actionType === "warning" && action.status === "active",
  ).length;
  const activePenalties = data.actions.filter(
    (action) => action.actionType === "penalty" && action.status === "active",
  ).length;
  const currentSuspensions = data.actions.filter(isCurrentSuspension).length;
  const totalPointsRemoved = data.actions
    .filter(
      (action) =>
        action.actionType === "points_deduction" &&
        action.status !== "cancelled",
    )
    .reduce((total, action) => total + action.pointsRemoved, 0);

  const initialLicenceId = data.licences.some(
    (licence) => licence.id === params.licence,
  )
    ? params.licence
    : undefined;

  const successMessage =
    params.success === "created"
      ? `Mesure enregistrée${params.case ? ` — ${params.case}` : ""}. Le pilote a été notifié.`
      : params.success === "cancelled"
        ? "La mesure a été annulée et le pilote a été notifié."
        : params.success === "completed"
          ? "La mesure a été clôturée."
          : null;

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/commissaires" className={styles.backLink}>
          ← Retour à l’espace commissaires
        </Link>
        <Link href="/dashboard/licences-pilotes" className="btn btn-secondary">
          Gérer les licences
        </Link>
      </div>

      <header className={styles.hero}>
        <div>
          <span>NOSTRA CIRCUIT · ACCÈS RÉSERVÉ</span>
          <h1>Gestion disciplinaire</h1>
          <p>
            Enregistre les avertissements, pénalités, suspensions temporaires et
            retraits de points sans annuler définitivement la licence.
          </p>
        </div>
        <div className={styles.heroBadge}>12 points par licence</div>
      </header>

      {successMessage ? (
        <div className={styles.success}>{successMessage}</div>
      ) : null}
      {params.error ? (
        <div className={styles.error}>
          {ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.save}
        </div>
      ) : null}

      <section className={styles.stats}>
        <article>
          <span>Avertissements actifs</span>
          <strong>{activeWarnings}</strong>
        </article>
        <article>
          <span>Pénalités actives</span>
          <strong>{activePenalties}</strong>
        </article>
        <article>
          <span>Licences suspendues</span>
          <strong>{currentSuspensions}</strong>
        </article>
        <article>
          <span>Points retirés</span>
          <strong>{totalPointsRemoved}</strong>
        </article>
      </section>

      <section
        id="nouvelle-decision"
        className={`${styles.panel} ${styles.decisionPanel}`}
      >
        <div className={styles.panelHeading}>
          <div>
            <span>NOUVELLE DÉCISION</span>
            <h2>Ajouter une mesure disciplinaire</h2>
          </div>
          <p>
            Chaque décision est horodatée, attribuée à son auteur et conservée
            dans l’historique, même après son annulation.
          </p>
        </div>
        <DisciplineForm
          licences={data.licences}
          initialLicenceId={initialLicenceId}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span>ÉTAT DES PILOTES</span>
            <h2>Points et suspensions par licence</h2>
          </div>
          <p>{data.licences.length} licence(s) officielle(s) suivie(s).</p>
        </div>

        <div className={styles.licenceGrid}>
          {data.licences.map((licence) => (
            <article className={styles.licenceCard} key={licence.id}>
              <div className={styles.licenceHead}>
                <div>
                  <span>{licence.licenceNumber}</span>
                  <h3>{licence.holderName}</h3>
                  <p>{licence.licenceName}</p>
                </div>
                <strong
                  className={
                    licence.currentSuspension
                      ? styles.suspended
                      : licence.pointsRemaining <= 3
                        ? styles.danger
                        : styles.points
                  }
                >
                  {licence.pointsRemaining}/12 pts
                </strong>
              </div>

              {licence.currentSuspension ? (
                <div className={styles.suspensionNotice}>
                  Suspendue jusqu’au {formatDate(licence.currentSuspension.suspensionEndsOn)}
                </div>
              ) : (
                <div className={styles.validNotice}>Licence non suspendue</div>
              )}

              <small>
                {licence.activeActions} mesure(s) active(s) · {licence.pointsRemoved} point(s) retiré(s)
              </small>

              {licence.pointsRemaining > 0 ? (
                <Link
                  href={`/commissaires/sanctions-disciplinaires?licence=${encodeURIComponent(licence.id)}#nouvelle-decision`}
                  className={styles.pointsButton}
                >
                  Retirer des points
                </Link>
              ) : (
                <span className={styles.noPointsButton}>
                  Aucun point restant
                </span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span>DOSSIERS DISCIPLINAIRES</span>
            <h2>Mesures enregistrées</h2>
          </div>
          <p>{filteredActions.length} résultat(s).</p>
        </div>

        <form className={styles.filters}>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Pilote, licence, dossier ou motif…"
          />
          <select name="status" defaultValue={statusFilter}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="completed">Clôturées</option>
            <option value="cancelled">Annulées</option>
          </select>
          <select name="type" defaultValue={typeFilter}>
            <option value="all">Tous les types</option>
            <option value="warning">Avertissements</option>
            <option value="penalty">Pénalités</option>
            <option value="suspension">Suspensions</option>
            <option value="points_deduction">Retraits de points</option>
          </select>
          <button className="btn btn-secondary" type="submit">
            Filtrer
          </button>
        </form>

        <div className={styles.actionList}>
          {filteredActions.length === 0 ? (
            <div className={styles.empty}>Aucune mesure ne correspond aux filtres.</div>
          ) : (
            filteredActions.map((action) => (
              <article className={styles.actionCard} key={action.id}>
                <div className={styles.actionTop}>
                  <div>
                    <span className={styles.caseNumber}>{action.caseNumber}</span>
                    <h3>{ACTION_LABELS[action.actionType]} · {action.holderName}</h3>
                    <p>{action.licenceNumber} · {action.licenceName}</p>
                  </div>
                  <div className={styles.actionBadges}>
                    <span className={`${styles.severity} ${styles[action.severity]}`}>
                      {action.severity === "minor"
                        ? "Mineur"
                        : action.severity === "major"
                          ? "Majeur"
                          : "Critique"}
                    </span>
                    <span className={`${styles.status} ${styles[action.status]}`}>
                      {action.status === "active"
                        ? "Active"
                        : action.status === "completed"
                          ? "Clôturée"
                          : "Annulée"}
                    </span>
                  </div>
                </div>

                <div className={styles.actionBody}>
                  <div>
                    <span>Motif</span>
                    <strong>{action.reason}</strong>
                  </div>
                  <div>
                    <span>Mesure appliquée</span>
                    <strong>{actionDetail(action)}</strong>
                  </div>
                  <div>
                    <span>Décision prise par</span>
                    <strong>{action.issuedByName}</strong>
                  </div>
                  <div>
                    <span>Date et heure</span>
                    <strong>{formatDateTime(action.issuedAt)}</strong>
                  </div>
                </div>

                {action.eventName || action.note ? (
                  <div className={styles.notes}>
                    {action.eventName ? <p><b>Événement :</b> {action.eventName}</p> : null}
                    {action.note ? <p><b>Observations :</b> {action.note}</p> : null}
                  </div>
                ) : null}

                {action.cancellationReason ? (
                  <div className={styles.cancelledNote}>
                    Motif d’annulation : {action.cancellationReason}
                  </div>
                ) : null}

                {action.status === "active" ? (
                  <div className={styles.actionControls}>
                    <form action={completeCircuitDisciplinaryAction}>
                      <input type="hidden" name="action_id" value={action.id} />
                      <input
                        name="completion_reason"
                        maxLength={2000}
                        placeholder="Observation de clôture facultative"
                      />
                      <button type="submit" className="btn btn-secondary">
                        Clôturer
                      </button>
                    </form>

                    <details>
                      <summary>Annuler la mesure</summary>
                      <form action={cancelCircuitDisciplinaryAction}>
                        <input type="hidden" name="action_id" value={action.id} />
                        <textarea
                          name="cancellation_reason"
                          rows={2}
                          minLength={3}
                          maxLength={2000}
                          required
                          placeholder="Motif obligatoire de l’annulation"
                        />
                        <button type="submit" className={styles.dangerButton}>
                          Confirmer l’annulation
                        </button>
                      </form>
                    </details>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span>TRAÇABILITÉ</span>
            <h2>Historique complet des décisions</h2>
          </div>
          <p>Les 300 dernières opérations des commissaires et de la Direction sont conservées.</p>
        </div>

        <div className={styles.historyTable}>
          <div className={styles.historyHeader}>
            <span>Date</span>
            <span>Dossier</span>
            <span>Pilote</span>
            <span>Opération</span>
            <span>Auteur</span>
          </div>
          {data.history.map((entry) => (
            <div className={styles.historyRow} key={entry.id}>
              <span>{formatDateTime(entry.createdAt)}</span>
              <span>{entry.caseNumber}</span>
              <span>{entry.holderName}<small>{entry.licenceNumber}</small></span>
              <span>
                {entry.eventType === "created"
                  ? "Création"
                  : entry.eventType === "cancelled"
                    ? "Annulation"
                    : entry.eventType === "auto_completed"
                      ? "Fin automatique"
                      : "Clôture"}
                {entry.reason ? <small>{entry.reason}</small> : null}
              </span>
              <span>{entry.changedByName}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
