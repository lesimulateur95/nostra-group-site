import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintLicenceButton } from "@/components/licenses/print-licence-button";
import { getLicenceLifecycle } from "@/lib/licenses/lifecycle";
import { createClient } from "@/lib/supabase/server";
import styles from "./licence.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Licence = {
  id: string;
  holder_name: string;
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

type DisciplineAction = {
  action_type: string;
  points_removed: number;
  suspension_starts_on: string | null;
  suspension_ends_on: string | null;
  reason: string;
  status: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Sans expiration";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export default async function CitizenLicencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  await Promise.allSettled([
    (supabase as any).rpc("nostra_sync_my_signed_pilot_licences_v75"),
    (supabase as any).rpc("nostra_refresh_expired_disciplinary_suspensions"),
  ]);

  const [licenceResult, disciplineResult] = await Promise.all([
    (supabase as any)
      .from("nostra_licences")
      .select(
        "id,holder_name,licence_number,licence_name,category,authority,valid_from,valid_until,permissions,notes,status,created_at",
      )
      .eq("id", id)
      .eq("holder_user_id", data.user.id)
      .maybeSingle(),
    (supabase as any)
      .from("nostra_circuit_disciplinary_actions")
      .select(
        "action_type,points_removed,suspension_starts_on,suspension_ends_on,reason,status",
      )
      .eq("licence_id", id),
  ]);

  // La licence officielle est la source de vérité. Une ancienne facture ou un
  // document manquant ne doit plus provoquer une page 404.
  if (licenceResult.error || !licenceResult.data) {
    notFound();
  }

  const licence = licenceResult.data as Licence;
  const actions = Array.isArray(disciplineResult.data)
    ? (disciplineResult.data as DisciplineAction[])
    : [];

  const pointsRemoved = actions
    .filter(
      (action) =>
        action.action_type === "points_deduction" &&
        action.status !== "cancelled",
    )
    .reduce((total, action) => total + Number(action.points_removed ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const suspension = actions.find(
    (action) =>
      action.action_type === "suspension" &&
      action.status !== "cancelled" &&
      Boolean(action.suspension_starts_on && action.suspension_ends_on) &&
      today >= String(action.suspension_starts_on) &&
      today <= String(action.suspension_ends_on),
  );

  const baseLifecycle = getLicenceLifecycle(
    licence.valid_from,
    licence.valid_until,
  );
  const displayedStatus = suspension ? "Suspendue" : baseLifecycle.label;

  return (
    <main className={styles.page}>
      <div className={styles.actions}>
        <Link className={styles.back} href="/profil/licences">
          ← Retour à mes licences
        </Link>
        <PrintLicenceButton />
      </div>

      <article className={styles.licence}>
        <header className={styles.header}>
          <div className={styles.logo}>N</div>
          <div>
            <span>NOSTRA GROUP</span>
            <h1>LICENCE OFFICIELLE</h1>
            <p>Direction générale · Administration sportive</p>
          </div>
          <strong>{licence.licence_number}</strong>
        </header>

        <section className={styles.identity}>
          <span>Titulaire de la licence</span>
          <h2>{licence.holder_name}</h2>
          <p>Citoyen Nostra Group</p>
        </section>

        <section className={styles.grid}>
          <div>
            <span>Type de licence</span>
            <strong>{licence.licence_name}</strong>
          </div>
          <div>
            <span>Catégorie / niveau</span>
            <strong>{licence.category || "Toutes catégories autorisées"}</strong>
          </div>
          <div>
            <span>Autorité émettrice</span>
            <strong>{licence.authority}</strong>
          </div>
          <div>
            <span>Statut</span>
            <strong>{displayedStatus}</strong>
          </div>
          <div>
            <span>Validité</span>
            <strong>
              {formatDate(licence.valid_from)} → {formatDate(licence.valid_until)}
            </strong>
          </div>
          <div>
            <span>Solde disciplinaire</span>
            <strong>{Math.max(0, 12 - pointsRemoved)}/12 points</strong>
          </div>
        </section>

        {suspension ? (
          <section className={styles.alert}>
            <strong>Suspension temporaire</strong>
            <p>
              Droits suspendus jusqu’au {formatDate(suspension.suspension_ends_on)}
              inclus. Motif : {suspension.reason}
            </p>
          </section>
        ) : null}

        <section className={styles.permissions}>
          <span>Droits et autorisations</span>
          <p>
            {suspension
              ? "Les droits liés à cette licence sont temporairement suspendus par décision de la Direction du Nostra Circuit."
              : licence.permissions ||
                "Les droits liés à cette licence sont accordés conformément aux règlements Nostra Group en vigueur."}
          </p>
        </section>

        {licence.notes ? (
          <section className={styles.permissions}>
            <span>Observations</span>
            <p>{licence.notes}</p>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <span>Document généré le {formatDate(licence.created_at)}</span>
          <span>Nostra Group · Numéro officiel vérifiable</span>
        </footer>
      </article>
    </main>
  );
}
