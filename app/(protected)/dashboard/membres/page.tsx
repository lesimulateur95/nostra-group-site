import { updateMemberRole } from "@/app/actions/admin-management";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { normalizeRoleKeys, ROLE_LABELS } from "@/lib/auth/access";
import { getMemberProfiles, getRolesCommissionersConfigured } from "@/lib/backoffice/data";
import { ROLES_COMMISSIONERS_SETUP_SQL } from "@/lib/backoffice/roles-commissioners-setup-sql";

export default async function MembersDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [members, rolesConfigured] = await Promise.all([getMemberProfiles(), getRolesCommissionersConfigured()]);

  return (
    <DashboardShell>
      <DashboardHeader title="Gestion des membres et rôles" description="Attribue un ou plusieurs rôles à chaque personne inscrite sur le site." />

      {!rolesConfigured && (
        <section className="dashboard-setup role-migration-setup">
          <span className="module-status">À exécuter une seule fois</span>
          <h2>Activer les rôles multiples et les outils Commissaires</h2>
          <p>Le SQL corrigé supprime d’abord l’ancien blocage de rôle, puis convertit les comptes en Citoyens et active les outils Commissaires.</p>
          <details>
            <summary>Afficher le code SQL V26.1 corrigé à copier dans Supabase</summary>
            <pre>{ROLES_COMMISSIONERS_SETUP_SQL}</pre>
          </details>
          <ol>
            <li>Copie tout le code corrigé.</li>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle le code, clique sur <strong>Run without RLS</strong>, puis recharge cette page avec <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}

      {rolesConfigured && (
        <div className="dashboard-feedback dashboard-feedback-success">Les rôles multiples et les outils Commissaires sont activés. Aucun SQL supplémentaire n’est nécessaire.</div>
      )}

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Les rôles ont été enregistrés.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de modifier les rôles. Vérifie que le code SQL V26 a bien été exécuté dans Supabase.</div>}

      <section className="member-admin-grid">
        {members.length === 0 && <div className="backoffice-panel empty-state">Aucun citoyen synchronisé. Les nouveaux comptes apparaîtront ici après leur prochaine connexion.</div>}
        {members.map((member) => {
          const rpName = [member.rp_first_name, member.rp_last_name].filter(Boolean).join(" ") || "Identité RP à compléter";
          const protectedManager = member.discord_id === "331843410962939908";
          const selectedRoles = normalizeRoleKeys(member.roles, member.role);

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
              <form action={updateMemberRole} className="member-role-form member-multi-role-form">
                <input type="hidden" name="user_id" value={member.user_id} />
                <fieldset>
                  <legend>Rôles attribués</legend>
                  <div className="member-role-checkbox-grid">
                    {Object.entries(ROLE_LABELS).map(([key, label]) => {
                      const lockedManager = protectedManager && key === "manager";
                      return (
                        <label className="member-role-checkbox" key={key}>
                          <input
                            type="checkbox"
                            name="roles"
                            value={key}
                            defaultChecked={selectedRoles.includes(key as keyof typeof ROLE_LABELS) || lockedManager}
                            disabled={lockedManager}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                {protectedManager && <span className="manager-protected-note">Le rôle Gérant du compte principal est protégé. Les autres rôles peuvent être ajoutés.</span>}
                <button className="btn" type="submit">Enregistrer les rôles</button>
              </form>
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}
