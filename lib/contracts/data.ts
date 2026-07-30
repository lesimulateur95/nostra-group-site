import { createClient } from "@/lib/supabase/server";

export type CircuitContract = {
  id: number;
  contract_number: string;
  organization_name: string;
  responsible_user_id: string;
  responsible_name: string;
  monthly_price: number;
  billing_day: number;
  payment_due_days: number;
  started_on: string;
  ends_on: string | null;
  next_billing_on: string;
  access_scope: string;
  authorized_people: number | null;
  notes: string | null;
  status: "draft" | "active" | "suspended" | "terminated" | "expired";
  created_at: string;
  updated_at: string;
};

export type ContractInstallment = {
  id: number;
  contract_id: number;
  user_id: string;
  billing_period: string;
  due_on: string;
  item_name: string;
  amount: number;
  status: "in_cart" | "paid" | "cancelled";
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type ContractPriceHistory = {
  id: number;
  contract_id: number;
  amount: number;
  effective_from: string;
  reason: string | null;
  created_at: string;
};

export async function getContractDashboardData(): Promise<{
  configured: boolean;
  contracts: CircuitContract[];
  installments: ContractInstallment[];
  prices: ContractPriceHistory[];
}> {
  const supabase = await createClient();
  await (supabase as any).rpc("generate_due_contract_renewals_v114", {
    p_user_id: null,
  });

  const [contracts, installments, prices] = await Promise.all([
    supabase
      .from("circuit_contracts")
      .select(
        "id,contract_number,organization_name,responsible_user_id,responsible_name,monthly_price,billing_day,payment_due_days,started_on,ends_on,next_billing_on,access_scope,authorized_people,notes,status,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("circuit_contract_installments")
      .select(
        "id,contract_id,user_id,billing_period,due_on,item_name,amount,status,paid_at,cancelled_at,created_at",
      )
      .order("billing_period", { ascending: false })
      .limit(300),
    supabase
      .from("circuit_contract_price_history")
      .select("id,contract_id,amount,effective_from,reason,created_at")
      .order("effective_from", { ascending: false })
      .limit(300),
  ]);

  const normalizedPrices = (prices.data ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount),
  })) as ContractPriceHistory[];

  const today = new Date().toISOString().slice(0, 10);
  const normalizedContracts = (contracts.data ?? []).map((row) => {
    const applicablePrice = normalizedPrices
      .filter(
        (price) =>
          Number(price.contract_id) === Number(row.id) &&
          price.effective_from <= today,
      )
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

    return {
      ...row,
      monthly_price: applicablePrice?.amount ?? Number(row.monthly_price),
    };
  }) as CircuitContract[];

  return {
    configured: !contracts.error && !installments.error && !prices.error,
    contracts: normalizedContracts,
    installments: (installments.data ?? []).map((row) => ({
      ...row,
      amount: Number(row.amount),
    })) as ContractInstallment[],
    prices: normalizedPrices,
  };
}

export async function getOwnContractCart(userId: string): Promise<{
  configured: boolean;
  items: ContractInstallment[];
}> {
  const supabase = await createClient();
  const generation = await (supabase as any).rpc(
    "generate_due_contract_renewals_v114",
    { p_user_id: userId },
  );

  const { data, error } = await supabase
    .from("circuit_contract_installments")
    .select(
      "id,contract_id,user_id,billing_period,due_on,item_name,amount,status,paid_at,cancelled_at,created_at",
    )
    .eq("user_id", userId)
    .eq("status", "in_cart")
    .order("billing_period");

  return {
    configured: !generation.error && !error,
    items: (data ?? []).map((row) => ({
      ...row,
      amount: Number(row.amount),
    })) as ContractInstallment[],
  };
}
