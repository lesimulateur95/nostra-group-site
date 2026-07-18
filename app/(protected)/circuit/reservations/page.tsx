import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function ReservationsPage() {
  return <CircuitCategoryOverview
    categoryKey="reservations"
    slug="reservations"
    eyebrow="Accès au circuit"
    title="Réservations"
    description="Vue d’ensemble des réservations du Nostra Circuit. Chaque information est maintenant publiée sur une page distincte."
    pages={[
      { href: "/circuit/reservations/demande", title: "Demande de créneau", description: "Procédure pour demander une réservation." },
      { href: "/circuit/reservations/validees", title: "Réservations validées", description: "Créneaux officiellement confirmés." },
      { href: "/circuit/reservations/conditions", title: "Conditions d’accès", description: "Règles et informations avant la venue." },
    ]}
  />;
}
