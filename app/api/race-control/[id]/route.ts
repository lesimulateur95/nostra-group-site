
import { NextResponse } from "next/server";
import { getRaceControlEventState } from "@/lib/race-control/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const route = await params;
  const eventId = Number.parseInt(route.id, 10);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json(
      {
        configured: false,
        server_now: new Date().toISOString(),
        event: null,
        entries: [],
        best_lap: null,
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const state = await getRaceControlEventState(eventId);

  return NextResponse.json(state, {
    status: state.event ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
