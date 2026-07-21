import { NextResponse } from "next/server";

import { getNostraEnvironment } from "@/lib/system/environment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const environment =
    getNostraEnvironment();

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const healthy =
    supabaseConfigured &&
    !environment.hasEnvironmentMismatch;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "warning",
      environment: environment.environment,
      data_environment:
        environment.dataEnvironment,
      branch: environment.branch,
      release: environment.releaseName,
      commit: environment.shortCommitSha,
      supabase_configured: supabaseConfigured,
      environment_mismatch:
        environment.hasEnvironmentMismatch,
      checked_at: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}
