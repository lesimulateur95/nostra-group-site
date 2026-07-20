
import { NextResponse } from "next/server";
import { getHomeReviewsData } from "@/lib/reviews/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = await getHomeReviewsData();

  return NextResponse.json(data, {
    status: data.configured ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
