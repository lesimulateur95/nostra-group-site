import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ required: false }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("nostra_delete_reason_required");
  return NextResponse.json({
    required: error ? true : Boolean(data),
    configured: !error,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 4) {
    return NextResponse.json({ error: "Motif trop court" }, { status: 400 });
  }

  const { error } = await supabase.rpc("nostra_set_pending_delete_reason", {
    p_reason: reason,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
