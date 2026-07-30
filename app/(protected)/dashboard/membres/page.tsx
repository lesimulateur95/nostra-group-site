import { redirect } from "next/navigation";

import { updateMemberRoles } from "@/app/actions/member-roles";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  MEMBER_ROLE_LABELS,
  MEMBER_ROLE_OPTIONS,
  getMembersWithRoles,
} from "@/lib/member-roles/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function MembersPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/dashboard");

  const [params, overview] = await Promise.all([
    searchParams,
    getMembersWithRoles(),
  ]);

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1 className="page-title">Membres et rôles</h1>
          <p className="lead">
            Le rôle Citoyen reste toujours actif. Tu peux ajouter ou retirer les
            autres rôles indépendamment.
          </p>
        </div>
      </section>

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Les rôles ont été enregistrés sans retirer le rôle Citoyen.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "setup"
            ? "Exécute le SQL V114 pour activer les rôles multiples."
            : "Les rôles n’ont pas pu être enregistrés."}
        </div>
      )}
      {!overview.configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          La table des membres n’est pas disponible.
        </div>
      )}

      <div className="member-role-list-v114">
        {overview.members.map((member) => {
          const name =
            [member.rp_first_name, member.rp_last_name]
              .filter(Boolean)
              .join(" ") || member.discord_name || member.email || "Membre";

          return (
            <form action={updateMemberRoles} className="dashboard-panel member-role-card-v114" key={member.user_id}>
              <input type="hidden" name="user_id" value={member.user_id} />
              <div>
                <span className="eyebrow">MEMBRE</span>
                <h3>{name}</h3>
                <p>{member.discord_name ?? member.email ?? member.user_id}</p>
              </div>

              <div className="member-role-options-v114">
                {MEMBER_ROLE_OPTIONS.map((role) => {
                  const isCitizen = role === "citizen";
                  const checked = isCitizen || member.roles.includes(role);
                  return (
                    <label key={role}>
                      <input
                        type="checkbox"
                        name="roles"
                        value={role}
                        defaultChecked={checked}
                        disabled={isCitizen}
                      />
                      <span>{MEMBER_ROLE_LABELS[role]}</span>
                    </label>
                  );
                })}
                <input type="hidden" name="roles" value="citizen" />
              </div>

              <button className="btn" type="submit">Enregistrer les rôles</button>
            </form>
          );
        })}
      </div>
    </DashboardShell>
  );
}
