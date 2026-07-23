"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasDashboardAccess } from "@/lib/auth/access";
import {
  isServiceKey,
  SERVICE_DEFINITIONS,
} from "@/lib/system/service-availability";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE_LENGTH = 500;
const PARIS_TIME_ZONE = "Europe/Paris";

function normalizeMessage(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_MESSAGE_LENGTH);
}

function getParisOffsetMilliseconds(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

function parisLocalDateTimeToIso(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  );

  let instant = new Date(utcGuess);
  instant = new Date(utcGuess - getParisOffsetMilliseconds(instant));
  instant = new Date(utcGuess - getParisOffsetMilliseconds(instant));

  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

async function requireServiceManager() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");
  if (!(await hasDashboardAccess(authData.user))) redirect("/accueil");

  const { data: canManage, error: permissionError } = await (supabase as any).rpc(
    "nostra_service_manager",
    { p_user_id: authData.user.id },
  );

  if (permissionError || canManage !== true) {
    throw new Error(
      "Seuls la Direction, les gérants et les managers peuvent modifier l’ouverture des services.",
    );
  }

  return { supabase, userId: authData.user.id };
}

function revalidateServicePages() {
  for (const definition of Object.values(SERVICE_DEFINITIONS)) {
    revalidatePath(definition.publicPath);
  }

  revalidatePath("/dashboard/licences-pilotes");
  revalidatePath("/dashboard/homologations");
  revalidatePath("/dashboard/inscriptions-ecuries");
  revalidatePath("/dashboard/circuit");
}

export async function setServiceAvailability(formData: FormData) {
  const serviceKey = formData.get("service_key");
  const isOpen = formData.get("is_open") === "true";

  if (!isServiceKey(serviceKey)) {
    throw new Error("Service Nostra Circuit invalide.");
  }

  const { supabase, userId } = await requireServiceManager();
  const { data, error } = await (supabase as any)
    .from("nostra_service_availability")
    .update({
      is_open: isOpen,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("service_key", serviceKey)
    .select("service_key")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Impossible de modifier l’ouverture du service. Vérifie que le SQL V55 a bien été exécuté.",
    );
  }

  revalidateServicePages();
}

export async function saveServiceAvailabilitySettings(formData: FormData) {
  const serviceKey = formData.get("service_key");
  const closedMessage = normalizeMessage(formData.get("closed_message"));
  const reopensAt = parisLocalDateTimeToIso(formData.get("reopens_at"));

  if (!isServiceKey(serviceKey)) {
    throw new Error("Service Nostra Circuit invalide.");
  }

  if (!closedMessage) {
    throw new Error("Le message de fermeture ne peut pas être vide.");
  }

  const { supabase, userId } = await requireServiceManager();
  const { data, error } = await (supabase as any)
    .from("nostra_service_availability")
    .update({
      closed_message: closedMessage,
      reopens_at: reopensAt,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("service_key", serviceKey)
    .select("service_key")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Impossible d’enregistrer le message ou la date. Vérifie que le SQL V55 a bien été exécuté.",
    );
  }

  revalidateServicePages();
}
