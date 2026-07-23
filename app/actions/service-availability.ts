"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasDashboardAccess } from "@/lib/auth/access";
import {
  isServiceKey,
  SERVICE_DEFINITIONS,
  type ServiceKey,
} from "@/lib/system/service-availability";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE_LENGTH = 500;
const PARIS_TIME_ZONE = "Europe/Paris";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

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

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

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

function parisLocalDateTimeToIso(
  value: FormDataEntryValue | null,
): string | null {
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

  const { data: canManage, error: permissionError } = await (
    supabase as any
  ).rpc("nostra_service_manager", {
    p_user_id: authData.user.id,
  });

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

function logServiceError(
  action: string,
  serviceKey: ServiceKey,
  error: SupabaseErrorLike | null,
) {
  console.error(`[Nostra Circuit] ${action}`, {
    serviceKey,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

/**
 * Met à jour le réglage existant. Si la ligne n'existe pas encore (cas des
 * trois nouvelles licences après une migration SQL incomplète), elle est
 * créée automatiquement au lieu de provoquer une page d'erreur Next.js.
 */
async function updateOrCreateService(
  serviceKey: ServiceKey,
  values: Record<string, unknown>,
  userId: string,
): Promise<boolean> {
  const { supabase } = await requireServiceManager();

  const updatePayload = {
    ...values,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { data: updatedRow, error: updateError } = await (
    supabase as any
  )
    .from("nostra_service_availability")
    .update(updatePayload)
    .eq("service_key", serviceKey)
    .select("service_key")
    .maybeSingle();

  if (updateError) {
    logServiceError("échec de mise à jour", serviceKey, updateError);
    return false;
  }

  if (updatedRow) return true;

  const definition = SERVICE_DEFINITIONS[serviceKey];
  const insertPayload = {
    service_key: serviceKey,
    is_open: true,
    closed_message: definition.closedMessage,
    reopens_at: null,
    ...updatePayload,
  };

  const { data: insertedRow, error: insertError } = await (
    supabase as any
  )
    .from("nostra_service_availability")
    .insert(insertPayload)
    .select("service_key")
    .maybeSingle();

  if (insertError || !insertedRow) {
    logServiceError(
      "échec de création du réglage manquant",
      serviceKey,
      insertError,
    );
    return false;
  }

  return true;
}

export async function setServiceAvailability(formData: FormData) {
  const serviceKey = formData.get("service_key");
  const isOpen = formData.get("is_open") === "true";

  if (!isServiceKey(serviceKey)) {
    console.error("[Nostra Circuit] Clé de service invalide", serviceKey);
    return;
  }

  const { userId } = await requireServiceManager();
  const saved = await updateOrCreateService(
    serviceKey,
    { is_open: isOpen },
    userId,
  );

  // Ne fait plus planter toute la page en cas de problème SQL. L'erreur
  // détaillée reste visible dans les logs Vercel pour le diagnostic.
  if (!saved) return;

  revalidateServicePages();
}

export async function saveServiceAvailabilitySettings(formData: FormData) {
  const serviceKey = formData.get("service_key");
  const closedMessage = normalizeMessage(formData.get("closed_message"));
  const reopensAt = parisLocalDateTimeToIso(formData.get("reopens_at"));

  if (!isServiceKey(serviceKey)) {
    console.error("[Nostra Circuit] Clé de service invalide", serviceKey);
    return;
  }

  if (!closedMessage) {
    console.error("[Nostra Circuit] Le message de fermeture est vide", {
      serviceKey,
    });
    return;
  }

  const { userId } = await requireServiceManager();
  const saved = await updateOrCreateService(
    serviceKey,
    {
      closed_message: closedMessage,
      reopens_at: reopensAt,
    },
    userId,
  );

  if (!saved) return;

  revalidateServicePages();
}
