import { NextResponse } from "next/server";
import { hasCommissionerAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LapRequestBody = {
  entry_id?: unknown;
  elapsed_ms?: unknown;
};

function rpcErrorCode(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): string {
  const value = `${error?.message ?? ""} ${error?.details ?? ""} ${
    error?.hint ?? ""
  }`.toLowerCase();

  if (value.includes("commissioner_required")) return "access";
  if (value.includes("invalid_event_status")) return "status";
  if (value.includes("invalid_entry_status")) return "entry_status";
  if (value.includes("invalid_lap")) return "lap";
  if (value.includes("use_finish_button")) return "finish";
  if (value.includes("duplicate_crossing")) return "duplicate";
  return "save";
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const route = await params;
  const eventId = Number.parseInt(route.id, 10);

  let body: LapRequestBody;

  try {
    body = (await request.json()) as LapRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "lap" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const entryId = Number(body.entry_id);
  const elapsedMs = Number(body.elapsed_ms);

  if (
    !Number.isInteger(eventId) ||
    eventId <= 0 ||
    !Number.isInteger(entryId) ||
    entryId <= 0 ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0
  ) {
    return NextResponse.json(
      { ok: false, error: "lap" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json(
      { ok: false, error: "auth" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (!(await hasCommissionerAccess(data.user))) {
    return NextResponse.json(
      { ok: false, error: "access" },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const { error } = await supabase.rpc(
    "nostra_record_race_control_lap",
    {
      p_entry_id: entryId,
      p_elapsed_ms: Math.max(0, Math.round(elapsedMs)),
    },
  );

  if (error) {
    return NextResponse.json(
      { ok: false, error: rpcErrorCode(error) },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
