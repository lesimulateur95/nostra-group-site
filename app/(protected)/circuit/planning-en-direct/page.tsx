import { LiveRacePlanning } from "@/components/circuit/live-race-planning";
import { getCommissionerModuleConfigured, getCommissionerRaceBriefing } from "@/lib/backoffice/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CircuitLivePlanningPage() {
  const configured = await getCommissionerModuleConfigured();
  const planning = configured ? await getCommissionerRaceBriefing() : null;

  return (
    <article className="circuit-document live-planning-page">
      {!configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le planning en direct n’est pas encore activé par la Direction du Nostra Circuit.
        </div>
      )}
      <LiveRacePlanning initialPlanning={planning} />
    </article>
  );
}
