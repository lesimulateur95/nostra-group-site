
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json(
      {
        configured: false,
        unread: 0,
        notifications: [],
      },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const [countResult, notificationsResult] = await Promise.all([
    supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authData.user.id)
      .is("read_at", null),
    supabase
      .from("user_notifications")
      .select(
        "id,notification_type,title,message,target_url,created_at",
      )
      .eq("user_id", authData.user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const configured =
    !countResult.error && !notificationsResult.error;

  return NextResponse.json(
    {
      configured,
      unread: configured ? countResult.count ?? 0 : 0,
      notifications: configured
        ? notificationsResult.data ?? []
        : [],
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
