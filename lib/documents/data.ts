import { createClient } from "@/lib/supabase/server";
import type { DocumentRegistryRow } from "@/lib/documents/types";

const REGISTRY_COLUMNS = [
  "id",
  "verification_code",
  "document_number",
  "owner_user_id",
  "citizen_name",
  "document_type",
  "document_title",
  "source_table",
  "source_id",
  "status",
  "issued_at",
  "expires_at",
  "signable",
  "signature_status",
  "signed_at",
  "signed_by",
  "signer_name",
  "metadata",
].join(",");

function metadataInvoiceId(document: DocumentRegistryRow): string | null {
  const value = document.metadata?.invoice_id;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return null;
}

export async function getRegistryForInvoice(
  invoiceId: string,
  ownerUserId?: string,
): Promise<DocumentRegistryRow | null> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("nostra_document_registry")
    .select(REGISTRY_COLUMNS)
    .order("issued_at", { ascending: false })
    .limit(500);

  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId);

  const { data, error } = await query;
  if (error) return null;

  return (
    ((data ?? []) as DocumentRegistryRow[]).find(
      (document) =>
        (document.source_table === "invoices" &&
          document.source_id === invoiceId) ||
        metadataInvoiceId(document) === invoiceId,
    ) ?? null
  );
}

export async function getRegistryForLicence(
  licenceId: string,
  ownerUserId?: string,
): Promise<DocumentRegistryRow | null> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("nostra_document_registry")
    .select(REGISTRY_COLUMNS)
    .eq("source_table", "nostra_licences")
    .eq("source_id", licenceId)
    .limit(1);

  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId);

  const { data, error } = await query.maybeSingle();
  if (error) return null;
  return (data as DocumentRegistryRow | null) ?? null;
}
