import { createClient } from "@/lib/supabase/server";

export type PilotLicenseType = {
  code: string;
  label: string;
  price: number;
  active: boolean;
  sort_order: number;
};

export type PilotLicenseCartItem = {
  id: number;
  user_id: string;
  license_code: string;
  license_label: string;
  applicant_name: string;
  phone: string;
  email: string;
  medical_certificate_path: string;
  medical_certificate_name: string;
  medical_certificate_mime: string;
  medical_certificate_size: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
};

export type PilotLicenseApplicationStatus =
  | "under_review"
  | "approved"
  | "rejected"
  | "new_certificate_requested"
  | "cancelled";

export type PilotLicenseApplication = {
  id: number;
  application_number: string;
  user_id: string;
  license_code: string;
  license_label: string;
  applicant_name: string;
  phone: string;
  email: string;
  medical_certificate_path: string;
  medical_certificate_name: string;
  medical_certificate_mime: string;
  medical_certificate_size: number;
  amount: number;
  payment_status: "paid" | "refunded";
  status: PilotLicenseApplicationStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  certificate_requested_at: string | null;
  certificate_replaced_at: string | null;
  document_id: number | null;
  paid_at: string;
  created_at: string;
  updated_at: string;
  certificateUrl: string | null;
};

export async function getPilotLicenseTypes(): Promise<PilotLicenseType[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("pilot_license_types")
      .select("code,label,price,active,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      code: String(row.code ?? ""),
      label: String(row.label ?? ""),
      price: Number(row.price ?? 0),
      active: Boolean(row.active),
      sort_order: Number(row.sort_order ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function getOwnPilotLicenseCart(
  userId: string,
): Promise<PilotLicenseCartItem | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("pilot_license_cart_items")
      .select(
        "id,user_id,license_code,license_label,applicant_name,phone,email,medical_certificate_path,medical_certificate_name,medical_certificate_mime,medical_certificate_size,unit_price,created_at,updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      ...data,
      id: Number(data.id),
      unit_price: Number(data.unit_price),
      medical_certificate_size: Number(data.medical_certificate_size),
    } as PilotLicenseCartItem;
  } catch {
    return null;
  }
}

export async function getPendingPilotLicenseCount(): Promise<number> {
  try {
    const supabase = await createClient();

    const { count, error } = await (supabase as any)
      .from("pilot_license_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "under_review");

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getPilotLicenseApplications(): Promise<
  PilotLicenseApplication[]
> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("pilot_license_applications")
      .select(
        "id,application_number,user_id,license_code,license_label,applicant_name,phone,email,medical_certificate_path,medical_certificate_name,medical_certificate_mime,medical_certificate_size,amount,payment_status,status,review_note,reviewed_by,reviewed_at,certificate_requested_at,certificate_replaced_at,document_id,paid_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    const rows = data as Array<Record<string, unknown>>;

    const withUrls: PilotLicenseApplication[] =
      await Promise.all(
        rows.map(
          async (
            row,
          ): Promise<PilotLicenseApplication> => {
        const certificatePath = String(
          row.medical_certificate_path ?? "",
        );

        let certificateUrl: string | null = null;

        if (certificatePath) {
          const signed = await supabase.storage
            .from("license-medical-certificates")
            .createSignedUrl(certificatePath, 20 * 60);

          certificateUrl = signed.data?.signedUrl ?? null;
        }

        return {
          id: Number(row.id),
          application_number: String(row.application_number ?? ""),
          user_id: String(row.user_id ?? ""),
          license_code: String(row.license_code ?? ""),
          license_label: String(row.license_label ?? ""),
          applicant_name: String(row.applicant_name ?? ""),
          phone: String(row.phone ?? ""),
          email: String(row.email ?? ""),
          medical_certificate_path: certificatePath,
          medical_certificate_name: String(
            row.medical_certificate_name ?? "",
          ),
          medical_certificate_mime: String(
            row.medical_certificate_mime ?? "",
          ),
          medical_certificate_size: Number(
            row.medical_certificate_size ?? 0,
          ),
          amount: Number(row.amount ?? 0),
              payment_status:
                row.payment_status === "refunded"
                  ? ("refunded" as const)
                  : ("paid" as const),
          status: String(
            row.status ?? "under_review",
          ) as PilotLicenseApplicationStatus,
          review_note:
            typeof row.review_note === "string"
              ? row.review_note
              : null,
          reviewed_by:
            typeof row.reviewed_by === "string"
              ? row.reviewed_by
              : null,
          reviewed_at:
            typeof row.reviewed_at === "string"
              ? row.reviewed_at
              : null,
          certificate_requested_at:
            typeof row.certificate_requested_at === "string"
              ? row.certificate_requested_at
              : null,
          certificate_replaced_at:
            typeof row.certificate_replaced_at === "string"
              ? row.certificate_replaced_at
              : null,
          document_id:
            row.document_id == null
              ? null
              : Number(row.document_id),
          paid_at: String(row.paid_at ?? ""),
          created_at: String(row.created_at ?? ""),
          updated_at: String(row.updated_at ?? ""),
          certificateUrl,
            };
          },
        ),
      );

    const priority: Record<PilotLicenseApplicationStatus, number> = {
      under_review: 0,
      new_certificate_requested: 1,
      approved: 2,
      rejected: 3,
      cancelled: 4,
    };

    return withUrls.sort(
      (left, right) =>
        priority[left.status] - priority[right.status] ||
        new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
    );
  } catch {
    return [];
  }
}
