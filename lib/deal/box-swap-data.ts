import { createClient } from "@/lib/supabase/server";

import type {
  DealBoxSwapDashboardState,
  DealBoxSwapPublicState,
} from "@/lib/deal/box-swap-types";

export async function getDealBoxSwapPublicState(): Promise<DealBoxSwapPublicState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "nostra_get_deal_box_swap_public_state",
    );

    if (error || !data) {
      return {
        configured: false,
        call: null,
        available_boxes: [],
      };
    }

    return data as DealBoxSwapPublicState;
  } catch {
    return {
      configured: false,
      call: null,
      available_boxes: [],
    };
  }
}

export async function getDealBoxSwapDashboardState(): Promise<DealBoxSwapDashboardState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "nostra_get_deal_box_swap_dashboard_state",
    );

    if (error || !data) {
      return {
        configured: false,
        sessions: [],
      };
    }

    return data as DealBoxSwapDashboardState;
  } catch {
    return {
      configured: false,
      sessions: [],
    };
  }
}
