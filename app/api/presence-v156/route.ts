import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });
  let path = "/";
  try {
    const body = await request.json();
    if (typeof body?.path === "string") path = body.path.slice(0, 500);
  } catch {}
  const { error } = await (supabase as any).rpc("nostra_presence_ping_v156", {
    p_path: path,
    p_user_agent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: !error });
}
