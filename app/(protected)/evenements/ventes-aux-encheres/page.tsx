import { redirect } from "next/navigation";

import { AuctionBoard } from "@/components/auctions/auction-board";
import { getPublicAuctions } from "@/lib/auctions/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    bid_saved?: string;
    abandoned?: string;
    bid_error?: string;
  }>;
};

export default async function PublicAuctionsPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const [auctions, params] = await Promise.all([
    getPublicAuctions(data.user.id),
    searchParams,
  ]);

  return (
    <AuctionBoard
      auctions={auctions}
      currentUserId={data.user.id}
      bidSaved={params.bid_saved === "1"}
      abandoned={params.abandoned === "1"}
      bidError={params.bid_error ?? null}
    />
  );
}
