import type {
  DocumentRegistryRow,
  PublicDocumentVerification,
} from "@/lib/documents/types";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://nostra-group-site.vercel.app";

export function verificationUrl(code: string): string {
  return `${SITE_URL}/verification/${encodeURIComponent(code)}`;
}

export function qrImageUrl(code: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(verificationUrl(code))}`;
}

export function documentTypeLabel(type: string, title?: string | null): string {
  if (title?.trim()) return title.trim();

  switch (type) {
    case "order_form":
      return "Bon de commande";
    case "invoice":
      return "Facture";
    case "license_application":
      return "Demande de licence";
    case "pilot_license_card":
      return "Licence pilote officielle";
    case "certificate":
      return "Certificat";
    case "contract":
      return "Contrat";
    default:
      return "Document Nostra Group";
  }
}

export function effectiveStatus(
  document: Pick<DocumentRegistryRow, "status" | "expires_at">,
): "valid" | "expired" | "cancelled" {
  if (document.status === "cancelled") return "cancelled";
  if (document.expires_at && new Date(document.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return "valid";
}

export function verificationStatusLabel(
  status: PublicDocumentVerification["verification_status"] | ReturnType<typeof effectiveStatus>,
): string {
  if (status === "cancelled") return "Annulé";
  if (status === "expired") return "Expiré";
  return "Valide";
}

export function signatureStatusLabel(
  status: DocumentRegistryRow["signature_status"],
): string {
  if (status === "signed") return "Signé";
  if (status === "not_required") return "Non requise";
  return "À signer";
}
