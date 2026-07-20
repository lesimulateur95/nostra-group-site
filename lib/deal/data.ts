
import { createClient } from "@/lib/supabase/server";
import type {
  DealDashboardState,
  DealPublicState,
} from "@/lib/deal/types";

export async function getDealModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deal_editions")
    .select("id", { head: true, count: "exact" });

  return !error;
}

export async function getDealPublicState(): Promise<DealPublicState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_deal_public_state",
  );

  if (error) {
    return {
      configured: false,
      edition: null,
      session: null,
    };
  }

  return data as DealPublicState;
}

export async function getDealDashboardState(): Promise<DealDashboardState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_deal_dashboard_state",
  );

  if (error) {
    return {
      edition: null,
      sessions: [],
    };
  }

  return data as DealDashboardState;
}
