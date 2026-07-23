export type DocumentRegistryStatus = "valid" | "cancelled";
export type DocumentSignatureStatus = "pending" | "signed" | "not_required";

export type DocumentRegistryRow = {
  id: string;
  verification_code: string;
  document_number: string;
  owner_user_id: string | null;
  citizen_name: string;
  document_type: string;
  document_title: string;
  source_table: string;
  source_id: string;
  status: DocumentRegistryStatus;
  issued_at: string;
  expires_at: string | null;
  signable: boolean;
  signature_status: DocumentSignatureStatus;
  signed_at: string | null;
  signed_by: string | null;
  signer_name: string | null;
  metadata: Record<string, unknown> | null;
};

export type PublicDocumentVerification = {
  verification_code: string;
  document_number: string;
  citizen_name: string;
  document_type: string;
  document_title: string;
  verification_status: "valid" | "expired" | "cancelled";
  issued_at: string;
  expires_at: string | null;
  signature_status: DocumentSignatureStatus;
  signed_at: string | null;
  signer_name: string | null;
};
