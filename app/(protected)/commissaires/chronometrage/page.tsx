import {
  RaceControlSetupPageContent,
  type RaceControlSetupSearchParams,
} from "@/components/race-control/race-control-setup-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RaceControlSetupPage({
  searchParams,
}: {
  searchParams: Promise<RaceControlSetupSearchParams>;
}) {
  return (
    <RaceControlSetupPageContent
      searchParams={searchParams}
      basePath="/commissaires/chronometrage"
      backPath="/commissaires"
      backLabel="Retour à l’espace Commissaire"
    />
  );
}
