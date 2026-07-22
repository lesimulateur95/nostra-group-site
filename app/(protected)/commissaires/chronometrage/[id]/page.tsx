import Link from "next/link";
import { redirect } from "next/navigation";

import { RaceTimingConsole } from "@/components/race-control/race-timing-console";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getRaceControlEventState } from "@/lib/race-control/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RaceControlLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    published?: string;
    unpublished?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);

  if (!roles.includes("manager") && !roles.includes("commissioner")) {
    redirect("/accueil");
  }

  const isManager = roles.includes("manager");
  const basePath = isManager
    ? "/dashboard/commissaires/chronometrage"
    : "/commissaires/chronometrage";

  const route = await params;
  const query = await searchParams;
  const eventId = Number.parseInt(route.id, 10);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    redirect(basePath);
  }

  const state = await getRaceControlEventState(eventId);

  return (
    <main className="dashboard-stack">
      <div>
        <Link className="btn btn-secondary" href={basePath}>
          ← Courses et grilles de départ
        </Link>
      </div>

      {query.created && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La grille est validée. Les chronomètres sont prêts.
        </div>
      )}

      {query.published && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Les résultats et les classements ont été mis à jour.
        </div>
      )}

      {query.unpublished && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Cette course a été retirée des résultats publics et des classements.
          Les chronos restent sauvegardés.
        </div>
      )}

      {query.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          La publication des résultats a échoué.
        </div>
      )}

      <RaceTimingConsole initialState={state} />
    </main>
  );
}
