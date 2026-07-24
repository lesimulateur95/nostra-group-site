import type { ReactNode } from "react";

import { ProfileBackBar } from "@/components/profile/profile-back-bar";
import { Topbar } from "@/components/site/topbar";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Topbar />
      <ProfileBackBar />
      <main className="profile-main">{children}</main>
    </>
  );
}
