"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_INCREMENTS = [
  100,
  1_000,
  10_000,
  50_000,
  100_000,
  500_000,
  1_000_000,
];

function text(formData: FormData, name: string, max = 2000): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function numberValue(formData: FormData, name: string): number {
  const parsed = Number(text(formData, name, 40));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return { supabase, user: data.user };
}

function revalidateAuctions() {
  revalidatePath("/evenements");
  revalidatePath("/evenements/ventes-aux-encheres");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/ventes-aux-encheres");
}

function firstVehicleImage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof (item as { url?: unknown }).url === "string"
    ) {
      return (item as { url: string }).url;
    }
  }

  return null;
}

export async function createVehicleAuction(formData: FormData) {
  const { supabase, user } = await requireManager();

  const vehicleId = numberValue(formData, "vehicle_id");
  const startPrice = numberValue(formData, "start_price");
  const durationHours = numberValue(formData, "duration_hours");
  const description = text(formData, "description", 2000);

  if (
    vehicleId <= 0 ||
    startPrice < 0 ||
    durationHours < 1 ||
    durationHours > 720
  ) {
    redirect("/dashboard/ventes-aux-encheres?error=invalid");
  }

  const { data: vehicle, error: vehicleError } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,brand,model,images,published")
    .eq("id", vehicleId)
    .eq("published", true)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    redirect("/dashboard/ventes-aux-encheres?error=vehicle");
  }

  const vehicleLabel = [vehicle.brand, vehicle.model]
    .filter(Boolean)
    .join(" ")
    .trim();

  const endsAt = new Date(
    Date.now() + durationHours * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await (supabase as any)
    .from("vehicle_auctions")
    .insert({
      vehicle_id: vehicleId,
      vehicle_label: vehicleLabel || `Véhicule ${vehicleId}`,
      vehicle_image_url: firstVehicleImage(vehicle.images),
      description: description || null,
      start_price: startPrice,
      current_price: startPrice,
      ends_at: endsAt,
      status: "active",
      created_by: user.id,
    });

  if (error) {
    redirect("/dashboard/ventes-aux-encheres?error=database");
  }

  revalidateAuctions();
  redirect("/dashboard/ventes-aux-encheres?created=1");
}

export async function placeAuctionBid(formData: FormData) {
  const auctionId = text(formData, "auction_id", 80);
  const increment = numberValue(formData, "increment");

  if (!auctionId || !ALLOWED_INCREMENTS.includes(increment)) {
    redirect("/evenements/ventes-aux-encheres?bid_error=invalid");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc("place_vehicle_auction_bid", {
    p_auction_id: auctionId,
    p_increment: increment,
  });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();

    const code = message.includes("abandoned")
      ? "abandoned"
      : message.includes("ended")
        ? "ended"
        : message.includes("inactive")
          ? "ended"
          : "database";

    redirect(`/evenements/ventes-aux-encheres?bid_error=${code}`);
  }

  revalidateAuctions();
  redirect("/evenements/ventes-aux-encheres?bid_saved=1");
}

export async function abandonVehicleAuction(formData: FormData) {
  const auctionId = text(formData, "auction_id", 80);

  if (!auctionId) {
    redirect("/evenements/ventes-aux-encheres?bid_error=invalid");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc(
    "abandon_vehicle_auction",
    {
      p_auction_id: auctionId,
    },
  );

  if (error) {
    redirect("/evenements/ventes-aux-encheres?bid_error=database");
  }

  revalidateAuctions();
  redirect("/evenements/ventes-aux-encheres?abandoned=1");
}

export async function cancelVehicleAuction(formData: FormData) {
  const { supabase } = await requireManager();
  const auctionId = text(formData, "auction_id", 80);

  if (!auctionId) {
    redirect("/dashboard/ventes-aux-encheres?error=invalid");
  }

  const { error } = await (supabase as any)
    .from("vehicle_auctions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", auctionId)
    .eq("status", "active");

  if (error) {
    redirect("/dashboard/ventes-aux-encheres?error=database");
  }

  revalidateAuctions();
  redirect("/dashboard/ventes-aux-encheres?cancelled=1");
}

export async function deleteVehicleAuction(formData: FormData) {
  const { supabase } = await requireManager();
  const auctionId = text(formData, "auction_id", 80);

  if (!auctionId) {
    redirect("/dashboard/ventes-aux-encheres?error=invalid");
  }

  const { error } = await (supabase as any)
    .from("vehicle_auctions")
    .delete()
    .eq("id", auctionId)
    .neq("status", "active");

  if (error) {
    redirect("/dashboard/ventes-aux-encheres?error=database");
  }

  revalidateAuctions();
  redirect("/dashboard/ventes-aux-encheres?deleted=1");
}
