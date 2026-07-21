import { getMyLoyaltyState } from "@/lib/loyalty/data";

import { ProfileLoyaltyPanelClient } from "@/components/loyalty/profile-loyalty-panel-client";

export async function ProfileLoyaltyPanel() {
  const state = await getMyLoyaltyState();

  return <ProfileLoyaltyPanelClient state={state} />;
}
