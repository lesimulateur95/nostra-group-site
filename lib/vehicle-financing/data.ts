/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createClient } from "@/lib/supabase/server";

export type VehicleFinancingStatus =
  | "pending_review"
  | "deposit_due"
  | "active"
  | "completed"
  | "rejected"
  | "cancelled";

export type VehicleFinancingSettings = {
  configured: boolean;
  enabled: boolean;
  threeTimesEnabled: boolean;
  fourTimesEnabled: boolean;
  minimumVehiclePrice: number;
  downPaymentPercent: number;
  threeTimesFeePercent: number;
  fourTimesFeePercent: number;
  installmentIntervalDays: number;
};

export type VehicleFinancingInstallment = {
  id: number;
  application_id: number;
  installment_number: number;
  amount: number;
  due_at: string;
  status: "pending" | "paid" | "cancelled";
  paid_at: string | null;
};

export type VehicleFinancingApplication = {
  id: number;
  application_number: string;
  user_id: string;
  steam_id: string | null;
  vehicle_id: number;
  customer_name: string;
  customer_phone: string | null;
  vehicle_name: string;
  catalog_type: string;
  vehicle_price: number;
  term_count: 3 | 4;
  down_payment_percent: number;
  down_payment_amount: number;
  financed_principal: number;
  fee_percent: number;
  fee_amount: number;
  financed_total: number;
  delivery_mode: "showroom" | "home";
  delivery_fee: number;
  delivery_address: string | null;
  delivery_phone: string | null;
  customer_note: string | null;
  status: VehicleFinancingStatus;
  review_note: string | null;
  bank_balance_at_review: number | null;
  bank_checked_at: string | null;
  reviewed_at: string | null;
  deposit_due_at: string | null;
  deposit_paid_at: string | null;
  completed_at: string | null;
  final_order_number: string | null;
  created_at: string;
  updated_at: string;
  installments: VehicleFinancingInstallment[];
};

const DEFAULT_SETTINGS: VehicleFinancingSettings = {
  configured: false,
  enabled: false,
  threeTimesEnabled: true,
  fourTimesEnabled: true,
  minimumVehiclePrice: 500_000,
  downPaymentPercent: 30,
  threeTimesFeePercent: 6,
  fourTimesFeePercent: 9,
  installmentIntervalDays: 30,
};

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getVehicleFinancingSettings(): Promise<VehicleFinancingSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("vehicle_financing_settings")
      .select(
        "enabled,three_times_enabled,four_times_enabled,minimum_vehicle_price,down_payment_percent,three_times_fee_percent,four_times_fee_percent,installment_interval_days",
      )
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return DEFAULT_SETTINGS;

    return {
      configured: true,
      enabled: data.enabled !== false,
      threeTimesEnabled: data.three_times_enabled !== false,
      fourTimesEnabled: data.four_times_enabled !== false,
      minimumVehiclePrice: numeric(data.minimum_vehicle_price, 500_000),
      downPaymentPercent: numeric(data.down_payment_percent, 30),
      threeTimesFeePercent: numeric(data.three_times_fee_percent, 6),
      fourTimesFeePercent: numeric(data.four_times_fee_percent, 9),
      installmentIntervalDays: Math.max(
        1,
        Math.trunc(numeric(data.installment_interval_days, 30)),
      ),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const APPLICATION_COLUMNS = [
  "id",
  "application_number",
  "user_id",
  "steam_id",
  "vehicle_id",
  "customer_name",
  "customer_phone",
  "vehicle_name",
  "catalog_type",
  "vehicle_price",
  "term_count",
  "down_payment_percent",
  "down_payment_amount",
  "financed_principal",
  "fee_percent",
  "fee_amount",
  "financed_total",
  "delivery_mode",
  "delivery_fee",
  "delivery_address",
  "delivery_phone",
  "customer_note",
  "status",
  "review_note",
  "bank_balance_at_review",
  "bank_checked_at",
  "reviewed_at",
  "deposit_due_at",
  "deposit_paid_at",
  "completed_at",
  "final_order_number",
  "created_at",
  "updated_at",
].join(",");

function normalizeInstallment(
  row: Record<string, unknown>,
): VehicleFinancingInstallment {
  return {
    id: numeric(row.id),
    application_id: numeric(row.application_id),
    installment_number: numeric(row.installment_number),
    amount: numeric(row.amount),
    due_at: String(row.due_at ?? ""),
    status:
      row.status === "paid" || row.status === "cancelled"
        ? row.status
        : "pending",
    paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
  };
}

function normalizeApplication(
  row: Record<string, unknown>,
  installments: VehicleFinancingInstallment[] = [],
): VehicleFinancingApplication {
  return {
    ...(row as Omit<VehicleFinancingApplication, "installments">),
    id: numeric(row.id),
    vehicle_id: numeric(row.vehicle_id),
    vehicle_price: numeric(row.vehicle_price),
    term_count: numeric(row.term_count) === 4 ? 4 : 3,
    down_payment_percent: numeric(row.down_payment_percent, 30),
    down_payment_amount: numeric(row.down_payment_amount),
    financed_principal: numeric(row.financed_principal),
    fee_percent: numeric(row.fee_percent),
    fee_amount: numeric(row.fee_amount),
    financed_total: numeric(row.financed_total),
    delivery_fee: numeric(row.delivery_fee),
    bank_balance_at_review:
      row.bank_balance_at_review == null
        ? null
        : numeric(row.bank_balance_at_review),
    steam_id: typeof row.steam_id === "string" ? row.steam_id : null,
    customer_phone:
      typeof row.customer_phone === "string" ? row.customer_phone : null,
    delivery_address:
      typeof row.delivery_address === "string" ? row.delivery_address : null,
    delivery_phone:
      typeof row.delivery_phone === "string" ? row.delivery_phone : null,
    customer_note:
      typeof row.customer_note === "string" ? row.customer_note : null,
    review_note:
      typeof row.review_note === "string" ? row.review_note : null,
    bank_checked_at:
      typeof row.bank_checked_at === "string" ? row.bank_checked_at : null,
    reviewed_at:
      typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    deposit_due_at:
      typeof row.deposit_due_at === "string" ? row.deposit_due_at : null,
    deposit_paid_at:
      typeof row.deposit_paid_at === "string" ? row.deposit_paid_at : null,
    completed_at:
      typeof row.completed_at === "string" ? row.completed_at : null,
    final_order_number:
      typeof row.final_order_number === "string"
        ? row.final_order_number
        : null,
    installments,
  } as VehicleFinancingApplication;
}

async function loadApplications(userId?: string): Promise<VehicleFinancingApplication[]> {
  try {
    const supabase = await createClient();
    let query = (supabase as any)
      .from("vehicle_financing_applications")
      .select(APPLICATION_COLUMNS)
      .order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error || !data) return [];

    const rows = data as Record<string, unknown>[];
    const ids = rows.map((row) => numeric(row.id)).filter((id) => id > 0);
    if (!ids.length) return rows.map((row) => normalizeApplication(row));

    const installmentResult = await (supabase as any)
      .from("vehicle_financing_installments")
      .select("id,application_id,installment_number,amount,due_at,status,paid_at")
      .in("application_id", ids)
      .order("installment_number", { ascending: true });
    const grouped = new Map<number, VehicleFinancingInstallment[]>();
    for (const raw of (installmentResult.data ?? []) as Record<string, unknown>[]) {
      const installment = normalizeInstallment(raw);
      grouped.set(installment.application_id, [
        ...(grouped.get(installment.application_id) ?? []),
        installment,
      ]);
    }

    return rows.map((row) =>
      normalizeApplication(row, grouped.get(numeric(row.id)) ?? []),
    );
  } catch {
    return [];
  }
}

export async function getVehicleFinancingApplications(): Promise<VehicleFinancingApplication[]> {
  return loadApplications();
}

export async function getOwnVehicleFinancingApplications(
  userId: string,
): Promise<VehicleFinancingApplication[]> {
  return loadApplications(userId);
}

export async function getVehicleFinancingSummary(): Promise<{
  configured: boolean;
  pending: number;
  depositDue: number;
  active: number;
}> {
  const [settings, applications] = await Promise.all([
    getVehicleFinancingSettings(),
    loadApplications(),
  ]);
  return {
    configured: settings.configured,
    pending: applications.filter((item) => item.status === "pending_review")
      .length,
    depositDue: applications.filter((item) => item.status === "deposit_due")
      .length,
    active: applications.filter((item) => item.status === "active").length,
  };
}
