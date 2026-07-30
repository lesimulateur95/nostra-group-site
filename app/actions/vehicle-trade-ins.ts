"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { parisLocalDateTimeToIso } from "@/lib/dates/paris";
import { createClient } from "@/lib/supabase/server";
import type { VehicleTradeInImage } from "@/lib/vehicle-trade-ins/data";

const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: FormDataEntryValue | null): number {
  const raw = text(value, 80).replace(/\s|€|\$/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function files(formData: FormData): File[] {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function uploadImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  selected: File[],
): Promise<VehicleTradeInImage[]> {
  const uploaded: VehicleTradeInImage[] = [];
  for (const file of selected) {
    const path = `used/${userId}/trade-in-${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const result = await supabase.storage.from("vehicle-images").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    if (result.error) {
      if (uploaded.length > 0) {
        await supabase.storage
          .from("vehicle-images")
          .remove(uploaded.map((image) => image.path));
      }
      throw result.error;
    }

    const publicUrl = supabase.storage.from("vehicle-images").getPublicUrl(path);
    uploaded.push({ path, url: publicUrl.data.publicUrl });
  }
  return uploaded;
}

function tradeInError(error: { message?: string | null; code?: string | null } | null | undefined) {
  const value = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (value.includes("registration_already_exists")) return "registration";
  if (value.includes("request_not_convertible")) return "status";
  if (
    value.includes("purchase_price_required") ||
    value.includes("resale_price_required")
  ) {
    return "price";
  }
  if (value.includes("invalid_trade_in")) return "invalid";
  if (value.includes("forbidden")) return "forbidden";
  if (
    value.includes("pgrst202") ||
    value.includes("vehicle_trade_in") ||
    value.includes("create_used_vehicle_v92") ||
    value.includes("convert_vehicle_trade_in_to_used_vehicle_v96")
  ) {
    return "setup";
  }
  return "save";
}

async function requireTradeInStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) {
    redirect("/accueil");
  }
  return { supabase, user: data.user };
}

function revalidateTradeIns() {
  revalidatePath("/motors/reprise");
  revalidatePath("/profil");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/occasion/demandes-reprise");
  revalidatePath("/dashboard/occasion/rachats");
  revalidatePath("/dashboard/occasion/catalogue");
  revalidatePath("/motors/catalogue/vehicules-occasion");
}

export async function submitVehicleTradeInRequest(formData: FormData) {
  const brand = text(formData.get("brand"), 100);
  const model = text(formData.get("model"), 140);
  const description = text(formData.get("description"), 5000);
  const mileage = Math.max(0, integer(formData.get("mileage"), 0));
  const selected = files(formData);

  if (!brand || !model || description.length < 10) {
    redirect("/motors/reprise?error=invalid");
  }
  if (selected.length > MAX_IMAGES) redirect("/motors/reprise?error=too-many");
  if (selected.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
    redirect("/motors/reprise?error=image-type");
  }
  if (selected.some((file) => file.size > MAX_IMAGE_SIZE)) {
    redirect("/motors/reprise?error=image-size");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  let uploaded: VehicleTradeInImage[] = [];
  try {
    uploaded = await uploadImages(supabase, data.user.id, selected);
  } catch {
    redirect("/motors/reprise?error=upload");
  }

  const metadata = data.user.user_metadata ?? {};
  const customerName =
    getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";
  const customerPhone =
    text(formData.get("customer_phone"), 80) ||
    (typeof metadata.phone === "string" ? metadata.phone.trim() : "") ||
    null;

  const { data: result, error } = await (supabase as any).rpc(
    "submit_vehicle_trade_in_v96",
    {
      p_customer_name: customerName,
      p_customer_email: data.user.email ?? null,
      p_customer_phone: customerPhone,
      p_brand: brand,
      p_model: model,
      p_version: text(formData.get("version"), 140) || null,
      p_registration: text(formData.get("registration"), 40).toUpperCase() || null,
      p_mileage: mileage,
      p_first_registration_year:
        integer(formData.get("first_registration_year"), 0) || null,
      p_vehicle_condition:
        text(formData.get("vehicle_condition"), 30) || "good",
      p_modifications: text(formData.get("modifications"), 3000) || null,
      p_desired_price: money(formData.get("desired_price")) || null,
      p_description: description,
      p_images: uploaded,
    },
  );

  if (error) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from("vehicle-images")
        .remove(uploaded.map((image) => image.path));
    }
    redirect(`/motors/reprise?error=${tradeInError(error)}`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const requestNumber =
    typeof response.request_number === "string" ? response.request_number : "envoyée";

  revalidateTradeIns();
  redirect(`/motors/reprise?sent=${encodeURIComponent(requestNumber)}`);
}

export async function reviewVehicleTradeInRequest(formData: FormData) {
  const requestId = integer(formData.get("request_id"));
  const status = text(formData.get("status"), 30);
  const allowed = new Set([
    "new",
    "reviewing",
    "offer_sent",
    "accepted",
    "refused",
    "cancelled",
  ]);

  if (requestId <= 0 || !allowed.has(status)) {
    redirect("/dashboard/occasion/demandes-reprise?error=invalid");
  }

  const { supabase } = await requireTradeInStaff();
  const { error } = await (supabase as any).rpc("review_vehicle_trade_in_v96", {
    p_request_id: requestId,
    p_status: status,
    p_proposed_purchase_price:
      money(formData.get("proposed_purchase_price")) || null,
    p_planned_resale_price: money(formData.get("planned_resale_price")) || null,
    p_assigned_staff: text(formData.get("assigned_staff"), 180) || null,
    p_appointment_at: parisLocalDateTimeToIso(
      text(formData.get("appointment_at"), 40),
    ),
    p_admin_note: text(formData.get("admin_note"), 3000) || null,
    p_internal_note: text(formData.get("internal_note"), 5000) || null,
  });

  if (error) {
    redirect(
      `/dashboard/occasion/demandes-reprise?error=${tradeInError(error)}`,
    );
  }

  revalidateTradeIns();
  redirect("/dashboard/occasion/demandes-reprise?saved=1");
}

export async function convertVehicleTradeInToUsedVehicle(formData: FormData) {
  const requestId = integer(formData.get("request_id"));
  if (requestId <= 0) {
    redirect("/dashboard/occasion/demandes-reprise?error=invalid");
  }

  const { supabase } = await requireTradeInStaff();
  const { data: result, error } = await (supabase as any).rpc(
    "convert_vehicle_trade_in_to_used_vehicle_v96",
    { p_request_id: requestId },
  );

  if (error) {
    redirect(
      `/dashboard/occasion/demandes-reprise?error=${tradeInError(error)}`,
    );
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const requestNumber =
    typeof response.request_number === "string"
      ? response.request_number
      : String(requestId);

  revalidateTradeIns();
  redirect(
    `/dashboard/occasion/demandes-reprise?converted=${encodeURIComponent(requestNumber)}`,
  );
}

export async function cancelOwnVehicleTradeInRequest(formData: FormData) {
  const requestId = integer(formData.get("request_id"));
  if (requestId <= 0) redirect("/motors/reprise?error=invalid");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc("cancel_vehicle_trade_in_v96", {
    p_request_id: requestId,
  });
  if (error) redirect(`/motors/reprise?error=${tradeInError(error)}`);

  revalidateTradeIns();
  redirect("/motors/reprise?cancelled=1");
}
