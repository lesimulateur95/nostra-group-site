import Link from "next/link";

import { deleteSavTicketV74 } from "@/app/actions/sav-v74";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import styles from "@/components/operations-v50/operations.module.css";
import { savTickets } from "@/lib/operations-v50/data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  deleted?: string;
  error?: string;
}>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [tickets, params] = await Promise.all([savTickets(), searchParams]);
  const open = tickets.filter(
    (ticket) => !["resolved", "closed"].includes(ticket.status),
  ).length;

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <Link className={styles.backLink} href="/dashboard">
            ← Retour au Dashboard
          </Link>
          <span>DIRECTION · NOSTRA MOTORS</span>
          <h1>SAV Nostra Motors</h1>
          <p>Gestion de tous les dossiers clients.</p>
        </section>

        {params.deleted ? (
          <div className={styles.success}>Dossier SAV supprimé définitivement.</div>
        ) : null}

        {params.error ? (
          <div className={styles.error}>
            Suppression impossible : {decodeURIComponent(params.error)}
          </div>
        ) : null}

        <section className={styles.stats}>
          <div className={styles.stat}>
            <span>TOTAL</span>
            <strong>{tickets.length}</strong>
          </div>
          <div className={styles.stat}>
            <span>À TRAITER</span>
            <strong>{open}</strong>
          </div>
          <div className={styles.stat}>
            <span>TERMINÉS</span>
            <strong>{tickets.length - open}</strong>
          </div>
          <div className={styles.stat}>
            <span>URGENTS</span>
            <strong>
              {
                tickets.filter(
                  (ticket) =>
                    ["urgent", "critical"].includes(ticket.priority) &&
                    !["resolved", "closed"].includes(ticket.status),
                ).length
              }
            </strong>
          </div>
        </section>

        <section className={styles.section}>
          {tickets.length ? (
            <div className={styles.list}>
              {tickets.map((ticket) => (
                <article className={styles.row} key={ticket.id}>
                  <div>
                    <h3>
                      {ticket.ticket_number} · {ticket.subject}
                    </h3>
                    <p>
                      {ticket.requester_name} · {ticket.status} · {ticket.priority}
                    </p>
                  </div>

                  <div className={styles.actions}>
                    <Link
                      className={styles.actionLink}
                      href={`/dashboard/sav/${ticket.id}`}
                    >
                      Gérer →
                    </Link>

                    <form action={deleteSavTicketV74}>
                      <input type="hidden" name="id" value={ticket.id} />
                      <button
                        className={`${styles.button} ${styles.danger}`}
                        type="submit"
                        title="Supprimer définitivement ce dossier SAV"
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Aucun dossier SAV.</div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
