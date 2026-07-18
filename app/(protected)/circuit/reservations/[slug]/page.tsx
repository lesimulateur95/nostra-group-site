import { notFound } from "next/navigation";
import { ReservationCalendar } from "@/components/calendar/reservation-calendar";
import { ChampionshipCalendar } from "@/components/calendar/championship-calendar";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";
import { getApprovedReservationSlots } from "@/lib/backoffice/data";
import { getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  if (slug === "demande") {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const approved = await getApprovedReservationSlots();
    const rp = getRpName(data.user).split(" ");
    const occupiedSlots = approved.map((request) => `${request.reservation_date}|${String(request.reservation_time).slice(0, 5)}`);

    return (
      <article className="circuit-document reservation-booking-page">
        <header className="document-hero">
          <p className="eyebrow">RÉSERVATIONS DU CIRCUIT</p>
          <h1 className="page-title">Calendrier des créneaux</h1>
          <p className="document-intro">Choisis directement une date et un horaire disponibles, puis envoie ta demande à la direction du Nostra Circuit.</p>
        </header>
        {query.sent && <div className="dashboard-feedback dashboard-feedback-success">Ta demande a bien été envoyée. Elle doit maintenant être validée depuis le Dashboard.</div>}
        {query.error === "occupied" && <div className="dashboard-feedback dashboard-feedback-error">Ce créneau vient d’être réservé. Choisis un autre horaire.</div>}
        {query.error && query.error !== "occupied" && <div className="dashboard-feedback dashboard-feedback-error">Vérifie la date, l’heure, ton nom et le motif de la réservation.</div>}
        <ReservationCalendar occupiedSlots={occupiedSlots} initialFirstName={rp[0] ?? ""} initialLastName={rp.slice(1).join(" ")} />
      </article>
    );
  }

  if (slug === "validees") {
    const approved = await getApprovedReservationSlots();
    const events = approved.map((request) => ({
      id: request.id,
      title: "Créneau réservé",
      description: request.reason,
      location: "Nostra Circuit",
      starts_at: `${request.reservation_date}T${String(request.reservation_time).slice(0, 5)}:00`,
      ends_at: null,
      status: request.status,
    }));
    return (
      <article className="circuit-document">
        <header className="document-hero">
          <p className="eyebrow">RÉSERVATIONS</p>
          <h1 className="page-title">Créneaux validés</h1>
          <p className="document-intro">Ce calendrier affiche les réservations confirmées par la direction du circuit.</p>
        </header>
        <ChampionshipCalendar events={events} title="CALENDRIER DU CIRCUIT" />
      </article>
    );
  }

  if (slug === "conditions") {
    return <SimpleEditablePage slug="reservations-conditions" title="Conditions d’accès" eyebrow="Réservations" intro="Conditions à respecter avant toute venue ou réservation." />;
  }

  notFound();
}
