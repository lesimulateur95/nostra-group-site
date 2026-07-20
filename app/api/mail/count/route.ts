
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json(
      { unread: 0 },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await supabase.rpc(
    "nostra_get_unread_mail_count",
  );

  const value = Array.isArray(data) ? data[0] : data;

  return NextResponse.json(
    { unread: error ? 0 : Number(value ?? 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
