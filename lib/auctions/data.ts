import { createClient } from "@/lib/supabase/server";

export type AuctionStatus = "active" | "ended" | "cancelled";

export type Auction = {
  id: string;
  vehicle_id: number | null;
  vehicle_label: string;
  vehicle_image_url: string | null;
  description: string | null;
  start_price: number;
  current_price: number;
  ends_at: string;
  status: AuctionStatus;
  winner_id: string | null;
  winner_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AuctionBid = {
  id: number;
  auction_id: string;
  user_id: string;
  bidder_name: string;
  amount: number;
  increment_amount: number;
  created_at: string;
};

export type AuctionWithBids = Auction & {
  bids: AuctionBid[];
  currentUserAbandoned: boolean;
};

export async function finalizeExpiredAuctions(): Promise<void> {
  try {
    const supabase = await createClient();
    await (supabase as any).rpc("finalize_expired_auctions");
  } catch {
    // Le cron Supabase reste le mécanisme principal. Cet appel sert de secours.
  }
}

export async function getActiveAuctionCount(): Promise<number> {
  try {
    await finalizeExpiredAuctions();

    const supabase = await createClient();
    const { count, error } = await (supabase as any)
      .from("vehicle_auctions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString());

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getPublicAuctions(
  currentUserId: string,
): Promise<AuctionWithBids[]> {
  await finalizeExpiredAuctions();

  const supabase = await createClient();

  const { data: auctionData, error: auctionError } = await (supabase as any)
    .from("vehicle_auctions")
    .select(
      "id,vehicle_id,vehicle_label,vehicle_image_url,description,start_price,current_price,ends_at,status,winner_id,winner_name,created_by,created_at,updated_at",
    )
    .in("status", ["active", "ended"])
    .order("status", { ascending: true })
    .order("ends_at", { ascending: true });

  if (auctionError || !auctionData) return [];

  const auctionIds = auctionData.map((auction: Auction) => auction.id);

  if (auctionIds.length === 0) return [];

  const [bidResult, abandonmentResult] = await Promise.all([
    (supabase as any)
      .from("vehicle_auction_bids")
      .select(
        "id,auction_id,user_id,bidder_name,amount,increment_amount,created_at",
      )
      .in("auction_id", auctionIds)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("vehicle_auction_abandonments")
      .select("auction_id")
      .eq("user_id", currentUserId)
      .in("auction_id", auctionIds),
  ]);

  const bids = (bidResult.data ?? []) as AuctionBid[];
  const abandonedIds = new Set(
    (abandonmentResult.data ?? []).map(
      (row: { auction_id: string }) => row.auction_id,
    ),
  );

  return (auctionData as Auction[]).map((auction) => ({
    ...auction,
    bids: bids.filter((bid) => bid.auction_id === auction.id),
    currentUserAbandoned: abandonedIds.has(auction.id),
  }));
}

export async function getDashboardAuctions(): Promise<AuctionWithBids[]> {
  await finalizeExpiredAuctions();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? "";

  const { data: auctionData, error: auctionError } = await (supabase as any)
    .from("vehicle_auctions")
    .select(
      "id,vehicle_id,vehicle_label,vehicle_image_url,description,start_price,current_price,ends_at,status,winner_id,winner_name,created_by,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (auctionError || !auctionData) return [];

  const auctionIds = auctionData.map((auction: Auction) => auction.id);
  if (auctionIds.length === 0) return [];

  const { data: bidData } = await (supabase as any)
    .from("vehicle_auction_bids")
    .select(
      "id,auction_id,user_id,bidder_name,amount,increment_amount,created_at",
    )
    .in("auction_id", auctionIds)
    .order("created_at", { ascending: false });

  const bids = (bidData ?? []) as AuctionBid[];

  return (auctionData as Auction[]).map((auction) => ({
    ...auction,
    bids: bids.filter((bid) => bid.auction_id === auction.id),
    currentUserAbandoned: false,
  }));
}

export async function getAuctionCatalogVehicles(): Promise<
  Array<{
    id: number;
    brand: string;
    model: string;
    price: number;
    imageUrl: string | null;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,brand,model,price,images,published")
    .eq("published", true)
    .order("brand", { ascending: true })
    .order("model", { ascending: true });

  if (error || !data) return [];

  return data.map(
    (vehicle: {
      id: number;
      brand: string;
      model: string;
      price: number;
      images: unknown;
    }) => {
      const images = Array.isArray(vehicle.images)
        ? (vehicle.images as Array<{ url?: unknown }>)
        : [];

      const imageUrl =
        typeof images[0]?.url === "string" ? images[0].url : null;

      return {
        id: Number(vehicle.id),
        brand: String(vehicle.brand ?? ""),
        model: String(vehicle.model ?? ""),
        price: Number(vehicle.price ?? 0),
        imageUrl,
      };
    },
  );
}
