import type { ReactNode } from "react";

import { ProfileLoyaltyPanel } from "@/components/loyalty/profile-loyalty-panel";

export default function ProfileTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <ProfileLoyaltyPanel />
    </>
  );
}
