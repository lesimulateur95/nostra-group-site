import { updateMemberRole } from "@/app/actions/admin-management";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ROLE_LABELS } from "@/lib/auth/access";
import { getMemberProfiles } from "@/lib/backoffice/data";

export default async function MembersDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const members = await getMemberProfiles();

  return (
    <DashboardShell>
      <DashboardHeader title="Gestion des membres et rôles" description="Attribue un rôle aux personnes qui ont créé leur compte sur le site." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le rôle a été enregistré.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de modifier ce rôle.</div>}

      <section className="member-admin-grid">
        {members.length === 0 && <div className="backoffice-panel empty-state">Aucun membre synchronisé. Les nouveaux comptes apparaîtront ici après leur prochaine connexion.</div>}
        {members.map((member) => {
          const rpName = [member.rp_first_name, member.rp_last_name].filter(Boolean).join(" ") || "Identité RP à compléter";
          const protectedManager = member.discord_id === "331843410962939908";
          return (
            <article className="backoffice-panel member-admin-card" key={member.user_id}>
              <div className="member-admin-head">
                {member.avatar_url ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={member.avatar_url} alt="" className="member-admin-avatar" />
                </> : <div className="member-admin-avatar member-admin-avatar-fallback">NG</div>}
                <div><h2>{rpName}</h2><p>{member.discord_name || "Compte Discord"} · {member.email || "E-mail non communiqué"}</p></div>
              </div>
              <dl className="member-admin-details">
                <div><dt>Discord ID</dt><dd>{member.discord_id || "Non détecté"}</dd></div>
                <div><dt>Inscription</dt><dd>{new Date(member.created_at).toLocaleDateString("fr-FR")}</dd></div>
              </dl>
              <form action={updateMemberRole} className="member-role-form">
                <input type="hidden" name="user_id" value={member.user_id} />
                <label>Rôle
                  <select name="role" defaultValue={protectedManager ? "manager" : member.role} disabled={protectedManager}>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                {protectedManager ? <span className="manager-protected-note">Compte gérant principal protégé</span> : <button className="btn" type="submit">Enregistrer le rôle</button>}
              </form>
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}
