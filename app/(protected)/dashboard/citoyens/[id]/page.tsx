import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  citizenDetail,
  type JsonRow,
} from "@/lib/operations-v50/data";

import styles from "@/components/operations-v50/operations.module.css";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.map(String).join(" · ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }

  return String(value);
}

function rows(value: unknown): JsonRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRow =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function recordTitle(record: JsonRow): string {
  return String(
    record.order_number ??
      record.ticket_number ??
      record.application_number ??
      record.document_title ??
      record.subject ??
      record.id ??
      "Enregistrement",
  );
}

function Records({
  name,
  value,
}: {
  name: string;
  value: unknown;
}) {
  const list = rows(value);

  return (
    <section className={styles.section}>
      <header>
        <span>HISTORIQUE</span>
        <h2>
          {name} · {list.length}
        </h2>
      </header>

      {list.length > 0 ? (
        <div className={styles.recordGrid}>
          {list.map((record, index) => (
            <article
              className={styles.record}
              key={`${recordTitle(record)}-${index}`}
            >
              <strong>{recordTitle(record)}</strong>
              <small>
                {text(
                  record.status ??
                    record.created_at ??
                    record.total,
                )}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          Aucun élément.
        </div>
      )}
    </section>
  );
}

export default async function CitizenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await citizenDetail(id);

  if (!detail) {
    notFound();
  }

  const profile = (detail.profile ?? {}) as JsonRow;
  const loyalty =
    detail.loyalty && typeof detail.loyalty === "object"
      ? (detail.loyalty as JsonRow)
      : null;

  const identityRows: Array<[string, unknown]> = [
    ["Nom", profile.name],
    ["E-mail", profile.email],
    ["Téléphone", profile.phone],
    ["Adresse", profile.address],
    [
      "Rôles",
      Array.isArray(profile.roles) && profile.roles.length > 0
        ? profile.roles
        : profile.role,
    ],
    ["Fidélité", loyalty?.label],
  ];

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <span>DIRECTION · FICHE CITOYEN</span>
          <h1>{text(profile.name)}</h1>
          <p>
            Vue centralisée des informations du compte.
          </p>
          <Link
            className={styles.actionLink}
            href="/dashboard/citoyens"
          >
            ← Retour
          </Link>
        </section>

        <section className={styles.section}>
          <header>
            <span>IDENTITÉ</span>
            <h2>Profil</h2>
          </header>

          <dl className={styles.details}>
            {identityRows.map(([label, value]) => (
              <div
                className={styles.detail}
                key={label}
              >
                <dt>{label}</dt>
                <dd>{text(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Records name="Commandes" value={detail.orders} />
        <Records
          name="Rendez-vous"
          value={detail.appointments}
        />
        <Records name="Licences" value={detail.licenses} />
        <Records name="Plaques" value={detail.plates} />
        <Records name="Documents" value={detail.documents} />
        <Records name="SAV" value={detail.sav} />
        <Records
          name="Candidatures"
          value={detail.recruitment}
        />
        <Records name="Journal" value={detail.audit} />
      </main>
    </DashboardShell>
  );
}
