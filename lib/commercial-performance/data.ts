import { createClient } from "@/lib/supabase/server";

export type CommercialOptionV137 = {
  userId: string;
  name: string;
};

export type CommissionSettingsV137 = {
  enabled: boolean;
  mode: "percent" | "fixed";
  value: number;
};

export type CommercialObjectiveV137 = {
  id: number;
  commercialUserId: string;
  commercialName: string;
  month: string;
  salesTarget: number;
  revenueTarget: number;
  targetBonus: number;
  paidAt: string | null;
};

export type CommercialCommissionV137 = {
  id: number;
  orderId: number;
  orderNumber: string;
  commercialUserId: string;
  commercialName: string;
  saleAmount: number;
  commissionMode: "percent" | "fixed";
  commissionValue: number;
  commissionAmount: number;
  status: string;
  saleDate: string;
  paidAt: string | null;
  creditedAt: string | null;
};

export type CommercialAccountV137 = {
  commercialUserId: string;
  commercialName: string;
  balance: number;
  totalCredited: number;
  updatedAt: string;
};

export type CommercialPaymentV137 = {
  id: number;
  commercialUserId: string;
  commercialName: string;
  month: string;
  commissionTotal: number;
  objectiveBonus: number;
  totalPaid: number;
  paidAt: string;
};

function memberName(row: Record<string, unknown>): string {
  const rp = [row.rp_first_name, row.rp_last_name]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .trim();
  return rp || String(row.discord_name || row.email || "Commercial");
}

function hasCommercialRole(row: Record<string, unknown>): boolean {
  const roles = [row.role, ...(Array.isArray(row.roles) ? row.roles : [])]
    .map((value) => String(value).toLowerCase())
    .join(" ");
  return roles.includes("commercial") || roles.includes("vendeur");
}

export async function getCommercialOptionsV137(): Promise<CommercialOptionV137[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_profiles")
    .select("user_id,discord_name,email,rp_first_name,rp_last_name,role,roles")
    .order("rp_last_name");

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(hasCommercialRole)
    .map((row) => ({ userId: String(row.user_id), name: memberName(row) }));
}

export async function getCommercialPerformanceV137() {
  const supabase = await createClient();
  const [settingsResult, objectivesResult, commissionsResult, paymentsResult, accountsResult] =
    await Promise.all([
      supabase
        .from("commercial_commission_settings_v137")
        .select("enabled,commission_mode,commission_value")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("commercial_objectives_v137")
        .select("id,commercial_user_id,commercial_name,objective_month,sales_target,revenue_target,target_bonus,paid_at")
        .order("objective_month", { ascending: false }),
      supabase
        .from("commercial_commissions_v137")
        .select("id,order_id,order_number,commercial_user_id,commercial_name,sale_amount,commission_mode,commission_value,commission_amount,status,sale_date,paid_at,credited_at")
        .order("sale_date", { ascending: false })
        .limit(300),
      supabase
        .from("commercial_payments_v137")
        .select("id,commercial_user_id,commercial_name,payment_month,commission_total,objective_bonus,total_paid,paid_at")
        .order("payment_month", { ascending: false })
        .limit(100),
      supabase
        .from("commercial_accounts_v137")
        .select("commercial_user_id,commercial_name,balance,total_credited,updated_at")
        .order("commercial_name"),
    ]);

  const configured = !settingsResult.error;
  const settings: CommissionSettingsV137 = {
    enabled: Boolean(settingsResult.data?.enabled ?? true),
    mode:
      settingsResult.data?.commission_mode === "fixed" ? "fixed" : "percent",
    value: Number(settingsResult.data?.commission_value ?? 0),
  };

  return {
    configured,
    settings,
    objectives: (objectivesResult.data ?? []).map((row) => ({
      id: Number(row.id),
      commercialUserId: String(row.commercial_user_id),
      commercialName: String(row.commercial_name),
      month: String(row.objective_month),
      salesTarget: Number(row.sales_target),
      revenueTarget: Number(row.revenue_target),
      targetBonus: Number(row.target_bonus),
      paidAt: row.paid_at ? String(row.paid_at) : null,
    })) as CommercialObjectiveV137[],
    commissions: (commissionsResult.data ?? []).map((row) => ({
      id: Number(row.id),
      orderId: Number(row.order_id),
      orderNumber: String(row.order_number),
      commercialUserId: String(row.commercial_user_id),
      commercialName: String(row.commercial_name),
      saleAmount: Number(row.sale_amount),
      commissionMode: row.commission_mode === "fixed" ? "fixed" : "percent",
      commissionValue: Number(row.commission_value),
      commissionAmount: Number(row.commission_amount),
      status: String(row.status),
      saleDate: String(row.sale_date),
      paidAt: row.paid_at ? String(row.paid_at) : null,
      creditedAt: row.credited_at ? String(row.credited_at) : null,
    })) as CommercialCommissionV137[],
    payments: (paymentsResult.data ?? []).map((row) => ({
      id: Number(row.id),
      commercialUserId: String(row.commercial_user_id),
      commercialName: String(row.commercial_name),
      month: String(row.payment_month),
      commissionTotal: Number(row.commission_total),
      objectiveBonus: Number(row.objective_bonus),
      totalPaid: Number(row.total_paid),
      paidAt: String(row.paid_at),
    })) as CommercialPaymentV137[],
    accounts: (accountsResult.data ?? []).map((row) => ({
      commercialUserId: String(row.commercial_user_id),
      commercialName: String(row.commercial_name),
      balance: Number(row.balance),
      totalCredited: Number(row.total_credited),
      updatedAt: String(row.updated_at),
    })) as CommercialAccountV137[],
  };
}

export async function getCommercialPendingCountV137(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("commercial_commissions_v137")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "approved"]);
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}
