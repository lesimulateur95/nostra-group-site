import { updateCircuitReservation } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getReservationModuleConfigured, getReservationRequests } from "@/lib/backoffice/data";
import { RESERVATION_SETUP_SQL } from "@/lib/backoffice/reservation-setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

export default async function ReservationDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const configured = await getReservationModuleConfigured();
  const requests = configured ? await getReservationRequests() : [];
  const pending = requests.filter((request) => request.status === "pending");
  const processed = requests.filter((request) => request.status !== "pending");

  return (
    <DashboardShell>
      <DashboardHeader title="Demandes de réservation" description="Valide ou refuse les créneaux choisis directement dans le calendrier du Nostra Circuit." />
      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les demandes de réservation</h2>
          <p>La table Supabase des réservations n’existe pas encore ou ses autorisations ne sont pas installées. Tant que cette étape n’est pas faite, aucune demande ne peut arriver ici.</p>
          <details open>
            <summary>Afficher le code SQL à copier dans Supabase</summary>
            <pre>{RESERVATION_SETUP_SQL}</pre>
          </details>
          <ol>
            <li>Copie tout le code ci-dessus.</li>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle le code, clique sur <strong>Run query</strong>, puis reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">La décision a été enregistrée.</div>}
      {params.error === "occupied" && <div className="dashboard-feedback dashboard-feedback-error">Un autre créneau validé existe déjà à cette date et cette heure.</div>}
      {params.error && params.error !== "occupied" && <div className="dashboard-feedback dashboard-feedback-error">Impossible de traiter cette demande.</div>}

      <section className="reservation-admin-summary">
        <article><span>À traiter</span><strong>{pending.length}</strong></article>
        <article><span>Total des demandes</span><strong>{requests.length}</strong></article>
      </section>

      <section className="reservation-admin-list">
        {pending.length === 0 && <div className="backoffice-panel empty-state">Aucune demande de réservation en attente.</div>}
        {pending.map((request) => <ReservationReview key={request.id} request={request} />)}
      </section>

      {processed.length > 0 && (
        <section className="processed-reservations">
          <div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">HISTORIQUE</p><h2>Demandes déjà traitées</h2></div>
          <div className="reservation-admin-list">{processed.map((request) => <ReservationReview key={request.id} request={request} />)}</div>
        </section>
      )}
    </DashboardShell>
  );
}

function ReservationReview({ request }: { request: Awaited<ReturnType<typeof getReservationRequests>>[number] }) {
  return (
    <article className="backoffice-panel reservation-review-card">
      <div className="reservation-review-head">
        <div>
          <span className={`request-status request-status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span>
          <h2>{request.first_name} {request.last_name}</h2>
          <p>Demande envoyée le {new Date(request.created_at).toLocaleString("fr-FR")}</p>
        </div>
        <div className="reservation-slot-badge"><strong>{new Date(`${request.reservation_date}T12:00:00`).toLocaleDateString("fr-FR")}</strong><span>{String(request.reservation_time).slice(0, 5)}</span></div>
      </div>
      <div className="reservation-reason"><span>Motif</span><p>{request.reason}</p></div>
      <form action={updateCircuitReservation} className="backoffice-form homologation-review-form">
        <input type="hidden" name="id" value={request.id} />
        <label>Décision<select name="status" defaultValue={request.status}><option value="pending">En attente</option><option value="approved">Valider le créneau</option><option value="rejected">Refuser</option><option value="cancelled">Annuler</option></select></label>
        <label className="form-span-2">Note visible par le demandeur<textarea name="admin_note" rows={3} defaultValue={request.admin_note ?? ""} /></label>
        <button className="btn" type="submit">Enregistrer la décision</button>
      </form>
    </article>
  );
}
