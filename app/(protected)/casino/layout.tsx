import { redirect } from "next/navigation";

import { CasinoShell } from "@/components/casino/casino-shell";
import { getRequestRoleKeys, getRequestUser } from "@/lib/auth/request-context";
import { getCasinoProfile, getCasinoSettings, getCasinoWallet } from "@/lib/casino/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasinoLayout({ children }: { children: React.ReactNode }) {
  const [user, roles, settings, profile, wallet] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
    getCasinoSettings(),
    getCasinoProfile(),
    getCasinoWallet(),
  ]);

  if (!user || !profile) redirect("/");

  const isManager = roles.includes("manager");
  if (!settings.publicEnabled && !isManager) redirect("/accueil");

  return (
    <CasinoShell
      profile={profile}
      settings={settings}
      wallet={wallet}
      privateMode={!settings.publicEnabled}
    >
      {children}
    </CasinoShell>
  );
}
