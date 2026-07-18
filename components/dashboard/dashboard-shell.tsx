import { redirect } from "next/navigation";
import { Topbar } from "@/components/site/topbar";
import { isManager } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!isManager(data.user)) redirect("/accueil");

  return (
    <div className="site-shell">
      <Topbar />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
