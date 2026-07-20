
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
        edition: null,
        session: null,
      },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const { data, error } = await supabase.rpc(
    "nostra_get_deal_public_state",
  );

  return NextResponse.json(
    error
      ? {
          configured: false,
          edition: null,
          session: null,
        }
      : data,
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
