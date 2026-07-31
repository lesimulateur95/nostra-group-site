import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LiveEventAdmin } from "@/components/live-events/live-event-admin";
import { getAllLiveEventBoards, getEventCitizens } from "@/lib/live-events/data";

export default async function LiveEventsDashboardPage() {
  const [events, citizens] = await Promise.all([
    getAllLiveEventBoards(),
    getEventCitizens(),
  ]);

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        eyebrow="JEUX NOSTRA GROUP"
        title="Tableaux d’événements en direct"
        description="Crée un tournoi à élimination ou un tableau libre, sélectionne les citoyens puis publie chaque changement en direct."
      />
      <LiveEventAdmin initialEvents={events} citizens={citizens} />
    </DashboardShell>
  );
}
