"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const FORM_PATH =
  "/circuit/administration-sportive/payer-ma-licence";
const DIRECTION_PATH = "/dashboard/licences-pilotes";
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

function validPhone(value: string): boolean {
  return /^[0-9+().\s-]{5,30}$/.test(value);
}

function firstRpcRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }

  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function revalidateLicensePages() {
  revalidatePath(FORM_PATH);
  revalidatePath("/profil");
  revalidatePath("/profil/documents");
  revalidatePath("/dashboard");
  revalidatePath(DIRECTION_PATH);
  revalidatePath("/dashboard/comptabilite");
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return { supabase, user: data.user };
}

function validateCertificate(
  certificate: FormDataEntryValue | null,
): File | null {
  if (!(certificate instanceof File) || certificate.size <= 0) {
    return null;
  }

  if (
    !ALLOWED_CERTIFICATE_TYPES.has(certificate.type) ||
    certificate.size > MAX_CERTIFICATE_SIZE
  ) {
    return null;
  }

  return certificate;
}

export async function addPilotLicenseToCart(
  formData: FormData,
) {
  const licenseCode = text(formData.get("license_code"), 30);
  const applicantName = text(formData.get("applicant_name"), 120);
  const phone = text(formData.get("phone"), 40);
  const certificateValue = formData.get("medical_certificate");

  if (applicantName.length < 3 || !validPhone(phone)) {
    redirect(`${FORM_PATH}?error=identity`);
  }

  if (!(certificateValue instanceof File) || certificateValue.size <= 0) {
    redirect(`${FORM_PATH}?error=certificate`);
  }

  if (!ALLOWED_CERTIFICATE_TYPES.has(certificateValue.type)) {
    redirect(`${FORM_PATH}?error=certificate-type`);
  }

  if (certificateValue.size > MAX_CERTIFICATE_SIZE) {
    redirect(`${FORM_PATH}?error=certificate-size`);
  }

  const certificate = certificateValue;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const [mailboxResult, licenseResult, existingResult] =
    await Promise.all([
      supabase.rpc("nostra_get_or_create_my_mailbox"),
      (supabase as any)
        .from("pilot_license_types")
        .select("code,label,price,active")
        .eq("code", licenseCode)
        .eq("active", true)
        .maybeSingle(),
      (supabase as any)
        .from("pilot_license_cart_items")
        .select("medical_certificate_path")
        .eq("user_id", authData.user.id)
        .maybeSingle(),
    ]);

  const mailbox = firstRpcRow(mailboxResult.data);
  const internalEmail =
    typeof mailbox?.address === "string"
      ? mailbox.address.trim().toLowerCase()
      : "";

  if (
    mailboxResult.error ||
    !internalEmail.endsWith("@nostra.group")
  ) {
    redirect(`${FORM_PATH}?error=mailbox`);
  }

  const licenseType = licenseResult.data;

  if (licenseResult.error || !licenseType) {
    redirect(`${FORM_PATH}?error=setup`);
  }

  const existing = existingResult.data;
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
        email: internalEmail,
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

export async function reviewPilotLicenseApplication(
  formData: FormData,
) {
  const { supabase } = await requireManager();

  const applicationId = Number(
    text(formData.get("application_id"), 30),
  );
  const decision = text(formData.get("decision"), 40);
  const note = text(formData.get("review_note"), 2000);

  if (
    !Number.isFinite(applicationId) ||
    applicationId <= 0 ||
    !["approved", "rejected", "new_certificate_requested"].includes(
      decision,
    )
  ) {
    redirect(`${DIRECTION_PATH}?error=invalid`);
  }

  if (
    ["rejected", "new_certificate_requested"].includes(decision) &&
    note.length < 3
  ) {
    redirect(`${DIRECTION_PATH}?error=note`);
  }

  const { error } = await (supabase as any).rpc(
    "review_pilot_license_application",
    {
      p_application_id: applicationId,
      p_decision: decision,
      p_note: note || null,
    },
  );

  if (error) {
    redirect(`${DIRECTION_PATH}?error=save`);
  }

  revalidateLicensePages();

  const success =
    decision === "approved"
      ? "approved"
      : decision === "rejected"
        ? "rejected"
        : "certificate";

  redirect(`${DIRECTION_PATH}?success=${success}`);
}

export async function deletePilotLicenseApplication(
  formData: FormData,
) {
  const { supabase } = await requireManager();

  const applicationId = Number(
    text(formData.get("application_id"), 30),
  );

  if (
    !Number.isFinite(applicationId) ||
    applicationId <= 0
  ) {
    redirect(`${DIRECTION_PATH}?error=invalid`);
  }

  const { data: result, error } = await (supabase as any).rpc(
    "delete_pilot_license_application",
    {
      p_application_id: applicationId,
    },
  );

  if (error) {
    redirect(`${DIRECTION_PATH}?error=delete`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};

  const certificatePath =
    typeof response.certificate_path === "string"
      ? response.certificate_path
      : null;

  if (certificatePath) {
    await supabase.storage
      .from("license-medical-certificates")
      .remove([certificatePath]);
  }

  revalidateLicensePages();
  redirect(`${DIRECTION_PATH}?success=deleted`);
}

export async function replacePilotLicenseCertificate(
  formData: FormData,
) {
  const applicationId = Number(
    text(formData.get("application_id"), 30),
  );
  const documentId = Number(text(formData.get("document_id"), 30));
  const certificateValue = formData.get("medical_certificate");

  if (
    !Number.isFinite(applicationId) ||
    applicationId <= 0 ||
    !Number.isFinite(documentId) ||
    documentId <= 0
  ) {
    redirect("/profil/documents?certificate_error=invalid");
  }

  if (!(certificateValue instanceof File) || certificateValue.size <= 0) {
    redirect(
      `/profil/documents/${documentId}?certificate_error=missing`,
    );
  }

  if (!ALLOWED_CERTIFICATE_TYPES.has(certificateValue.type)) {
    redirect(
      `/profil/documents/${documentId}?certificate_error=type`,
    );
  }

  if (certificateValue.size > MAX_CERTIFICATE_SIZE) {
    redirect(
      `/profil/documents/${documentId}?certificate_error=size`,
    );
  }

  const certificate = validateCertificate(certificateValue);

  if (!certificate) {
    redirect(
      `/profil/documents/${documentId}?certificate_error=invalid`,
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const certificatePath = `${authData.user.id}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(certificate.type)}`;

  const upload = await supabase.storage
    .from("license-medical-certificates")
    .upload(certificatePath, certificate, {
      cacheControl: "3600",
      contentType: certificate.type,
      upsert: false,
    });

  if (upload.error) {
    redirect(
      `/profil/documents/${documentId}?certificate_error=upload`,
    );
  }

  const { data: result, error } = await (supabase as any).rpc(
    "replace_pilot_license_certificate",
    {
      p_application_id: applicationId,
      p_certificate_path: certificatePath,
      p_certificate_name: certificate.name.slice(0, 240),
      p_certificate_mime: certificate.type,
      p_certificate_size: certificate.size,
    },
  );

  if (error) {
    await supabase.storage
      .from("license-medical-certificates")
      .remove([certificatePath]);

    redirect(
      `/profil/documents/${documentId}?certificate_error=save`,
    );
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};

  const oldPath =
    typeof response.old_certificate_path === "string"
      ? response.old_certificate_path
      : null;

  if (oldPath && oldPath !== certificatePath) {
    await supabase.storage
      .from("license-medical-certificates")
      .remove([oldPath]);
  }

  revalidateLicensePages();
  revalidatePath(`/profil/documents/${documentId}`);

  redirect(
    `/profil/documents/${documentId}?certificate_replaced=1`,
  );
}
