
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json(
      { unread: 0 },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { count } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .is("read_at", null);

  return NextResponse.json(
    { unread: count ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
