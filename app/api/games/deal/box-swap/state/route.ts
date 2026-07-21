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
        call: null,
        available_boxes: [],
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { data, error } = await (supabase as any).rpc(
    "nostra_get_deal_box_swap_public_state",
  );

  return NextResponse.json(
    error
      ? {
          configured: false,
          call: null,
          available_boxes: [],
        }
      : data,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
