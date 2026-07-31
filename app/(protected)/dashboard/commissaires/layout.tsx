import { redirect } from "next/navigation";

import { CommissionerBackLinkFix } from "@/components/commissaires/commissioner-back-link-fix";
import { getRequestRoleKeys, getRequestUser } from "@/lib/auth/request-context";

export default async function CommissionerToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, roles] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
  ]);

  if (
    !user ||
    (!roles.includes("manager") && !roles.includes("commissioner"))
  ) {
    redirect("/accueil");
  }

  return (
    <>
      <CommissionerBackLinkFix />
      {children}
    </>
  );
}
