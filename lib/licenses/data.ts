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
