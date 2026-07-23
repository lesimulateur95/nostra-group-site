import { createClient } from "@/lib/supabase/server";

export type DealLiveCitizen = {
  user_id: string;
  display_name: string;
};

export type DealLiveEdition = {
  id: number;
  title: string;
  active_session_id: string | null;
  selected_player_user_id: string | null;
  selected_player_name: string | null;
  launched_at: string | null;
};

export type DealLiveAdminState = {
  configured: boolean;
  edition: DealLiveEdition | null;
  citizens: DealLiveCitizen[];
};

export async function getDealLiveAdminState(): Promise<DealLiveAdminState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_deal_live_admin_state",
  );

  if (error) {
    return {
      configured: false,
      edition: null,
      citizens: [],
    };
  }

  const state = data as Partial<DealLiveAdminState> | null;
  return {
    configured: state?.configured === true,
    edition: state?.edition ?? null,
    citizens: Array.isArray(state?.citizens) ? state.citizens : [],
  };
}
