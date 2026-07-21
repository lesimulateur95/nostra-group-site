"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const FORM_PATH =
  "/circuit/administration-sportive/payer-ma-licence";
const MAX_CERTIFICATE_SIZE = 10 * 1024 * 1024;
const ALLOWED_CERTIFICATE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function text(
  value: FormDataEntryValue | null,
  max = 500,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function extensionFor(type: string): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  return "jpg";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string): boolean {
  return /^[0-9+().\s-]{5,30}$/.test(value);
}

function revalidateLicensePages() {
  revalidatePath(FORM_PATH);
  revalidatePath("/profil");
  revalidatePath("/profil/documents");
  revalidatePath("/dashboard/comptabilite");
}

export async function addPilotLicenseToCart(
  formData: FormData,
) {
  const licenseCode = text(formData.get("license_code"), 30);
  const applicantName = text(formData.get("applicant_name"), 120);
  const phone = text(formData.get("phone"), 40);
  const email = text(formData.get("email"), 180).toLowerCase();
  const certificate = formData.get("medical_certificate");

  if (
    applicantName.length < 3 ||
    !validPhone(phone) ||
    !validEmail(email)
  ) {
    redirect(`${FORM_PATH}?error=identity`);
  }

  if (!(certificate instanceof File) || certificate.size <= 0) {
    redirect(`${FORM_PATH}?error=certificate`);
  }

  if (!ALLOWED_CERTIFICATE_TYPES.has(certificate.type)) {
    redirect(`${FORM_PATH}?error=certificate-type`);
  }

  if (certificate.size > MAX_CERTIFICATE_SIZE) {
    redirect(`${FORM_PATH}?error=certificate-size`);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const { data: licenseType, error: typeError } = await (
    supabase as any
  )
    .from("pilot_license_types")
    .select("code,label,price,active")
    .eq("code", licenseCode)
    .eq("active", true)
    .maybeSingle();

  if (typeError || !licenseType) {
    redirect(`${FORM_PATH}?error=setup`);
  }

  const { data: existing } = await (supabase as any)
    .from("pilot_license_cart_items")
    .select("medical_certificate_path")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const certificatePath = `${authData.user.id}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(certificate.type)}`;

  const upload = await supabase.storage
    .from("license-medical-certificates")
    .upload(certificatePath, certificate, {
      cacheControl: "3600",
      contentType: certificate.type,
      upsert: false,
    });

  if (upload.error) {
    redirect(`${FORM_PATH}?error=upload`);
  }

  const { error: saveError } = await (supabase as any)
    .from("pilot_license_cart_items")
    .upsert(
      {
        user_id: authData.user.id,
        license_code: String(licenseType.code),
        license_label: String(licenseType.label),
        applicant_name: applicantName,
        phone,
        email,
        medical_certificate_path: certificatePath,
        medical_certificate_name: certificate.name.slice(0, 240),
        medical_certificate_mime: certificate.type,
        medical_certificate_size: certificate.size,
        unit_price: Number(licenseType.price),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

  if (saveError) {
    await supabase.storage
      .from("license-medical-certificates")
      .remove([certificatePath]);

    redirect(`${FORM_PATH}?error=save`);
  }

  const oldPath =
    typeof existing?.medical_certificate_path === "string"
      ? existing.medical_certificate_path
      : null;

  if (oldPath && oldPath !== certificatePath) {
    await supabase.storage
      .from("license-medical-certificates")
      .remove([oldPath]);
  }

  revalidateLicensePages();
  redirect("/profil?license_added=1");
}

export async function removePilotLicenseCart() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const { data: cart } = await (supabase as any)
    .from("pilot_license_cart_items")
    .select("id,medical_certificate_path")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (cart?.id) {
    await (supabase as any)
      .from("pilot_license_cart_items")
      .delete()
      .eq("id", cart.id)
      .eq("user_id", authData.user.id);
  }

  if (typeof cart?.medical_certificate_path === "string") {
    await supabase.storage
      .from("license-medical-certificates")
      .remove([cart.medical_certificate_path]);
  }

  revalidateLicensePages();
  redirect("/profil?license_removed=1");
}

export async function checkoutPilotLicenseCart() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const { data: result, error } = await (supabase as any).rpc(
    "checkout_pilot_license_cart",
  );

  if (error) {
    const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

    const code =
      message.includes("empty_license_cart")
        ? "empty"
        : message.includes("license_setup_missing") ||
            message.includes("pgrst202")
          ? "setup"
          : "save";

    redirect(`/profil?license_order_error=${code}`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};

  const reference =
    typeof response.application_number === "string"
      ? response.application_number
      : "Licence";

  revalidateLicensePages();
  redirect(
    `/profil?license_paid=${encodeURIComponent(reference)}`,
  );
}
