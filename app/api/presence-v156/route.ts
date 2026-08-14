import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let path = "/";
  try {
    const body = await request.json();
    if (typeof body?.path === "string") path = body.path.trim().slice(0, 500) || "/";
  } catch {}

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await (admin as any)
    .from("nostra_presence_v156")
    .upsert(
      {
        user_id: data.user.id,
        last_seen_at: now,
        current_path: path,
        user_agent: request.headers.get("user-agent")?.slice(0, 800) ?? "",
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, path, lastSeenAt: now },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
