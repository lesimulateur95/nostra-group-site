import { redirect } from "next/navigation";

import { DiscordRecruitmentAnnouncement } from "@/components/dashboard/discord-recruitment-announcement";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getRequestRoleKeys,
  getRequestUser,
} from "@/lib/auth/request-context";

export default async function DiscordRecruitmentAnnouncementPage() {
  const [user, roles] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
  ]);

  if (!user) redirect("/");
  if (!roles.includes("manager")) redirect("/dashboard");

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">RECRUTEMENT</span>
          <h1 className="page-title">Annonce Discord</h1>
          <p className="lead">
            Prépare une annonce Nostra Group, copie-la puis colle-la dans le
            salon souhaité du Discord du serveur.
          </p>
        </div>
        <span className="manager-seal">SANS WEBHOOK</span>
      </section>

      <DiscordRecruitmentAnnouncement />
    </DashboardShell>
  );
}
