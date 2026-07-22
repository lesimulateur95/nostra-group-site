"use client";

import { useMemo, useState } from "react";

import {
  blockAccountAction,
  createBackupAction,
  permanentlyDeleteTrashItemAction,
  refreshSecurityTriggersAction,
  restoreTrashItemAction,
  savePageAccessAction,
  setDirectionAccessAction,
  unblockAccountAction,
  updateSecuritySettingsAction,
} from "@/app/actions/security-administration";
import {
  SECURITY_ROLE_OPTIONS,
  type SecurityOverview,
  type SecurityPageAccess,
} from "@/lib/security/types";

import styles from "./security-administration-panel.module.css";

const TABS = [
  ["permissions", "Permissions des pages"],
  ["comptes", "Comptes"],
  ["maintenance", "Maintenance"],
  ["corbeille", "Corbeille"],
  ["sauvegardes", "Sauvegardes"],
  ["connexions", "Connexions"],
  ["journal", "Journal"],
] as const;

type TabKey = (typeof TABS)[number][0];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function roleLabel(role: string) {
  return SECURITY_ROLE_OPTIONS.find((item) => item.key === role)?.label ?? role;
}

function PageAccessForm({ page }: { page: SecurityPageAccess }) {
  return (
    <form action={savePageAccessAction} className={styles.permissionCard}>
      <input type="hidden" name="id" value={page.id} />
      <div className={styles.permissionHeader}>
        <div>
          <strong>{page.label}</strong>
          <code>{page.path_pattern}</code>
        </div>
        <label className={styles.switchLabel}>
          <input type="checkbox" name="active" defaultChecked={page.active} />
          Page ouverte
        </label>
      </div>

      <div className={styles.compactFields}>
        <label>
          Nom
          <input name="label" defaultValue={page.label} required />
        </label>
        <label>
          Catégorie
          <input name="category" defaultValue={page.category} required />
        </label>
        <label>
          Chemin
          <input name="path_pattern" defaultValue={page.path_pattern} required />
        </label>
        <label>
          Ordre
          <input name="sort_order" type="number" defaultValue={page.sort_order} />
        </label>
      </div>

      <div className={styles.roleMatrix}>
        {SECURITY_ROLE_OPTIONS.map((role) => (
          <label key={role.key}>
            <input
              type="checkbox"
              name={`role_${role.key}`}
              defaultChecked={page.allowed_roles.includes(role.key)}
              disabled={page.path_pattern === "/dashboard/securite" && role.key === "direction"}
            />
            <span>{role.label}</span>
          </label>
        ))}
      </div>
      {page.path_pattern === "/dashboard/securite" && (
        <input type="hidden" name="role_direction" value="on" />
      )}
      <button className={styles.primaryButton} type="submit">Enregistrer cette page</button>
    </form>
  );
}

export function SecurityAdministrationPanel({
  overview,
  initialTab = "permissions",
}: {
  overview: SecurityOverview;
  initialTab?: string;
}) {
  const firstTab = TABS.some(([key]) => key === initialTab)
    ? (initialTab as TabKey)
    : "permissions";
  const [tab, setTab] = useState<TabKey>(firstTab);
  const [pageSearch, setPageSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const filteredPages = useMemo(() => {
    const query = pageSearch.trim().toLowerCase();
    if (!query) return overview.pages;
    return overview.pages.filter((page) =>
      `${page.label} ${page.category} ${page.path_pattern}`.toLowerCase().includes(query),
    );
  }, [overview.pages, pageSearch]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return overview.members;
    return overview.members.filter((member) =>
      `${member.display_name} ${member.roles.join(" ")}`.toLowerCase().includes(query),
    );
  }, [overview.members, memberSearch]);

  return (
    <section className={styles.wrapper}>
      <nav className={styles.tabs} aria-label="Sécurité et administration">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={tab === key ? styles.activeTab : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "permissions" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div>
              <span>ACCÈS PAR RÔLE</span>
              <h2>Pages accessibles depuis le site</h2>
              <p>
                Modifie directement les accès Direction, Gérant, Commercial, Employé,
                Commissaire et Citoyen. La vérification est appliquée avant l’ouverture de la page.
              </p>
            </div>
            <input
              className={styles.search}
              value={pageSearch}
              onChange={(event) => setPageSearch(event.target.value)}
              placeholder="Rechercher une page…"
            />
          </div>

          <details className={styles.addPanel}>
            <summary>+ Ajouter une nouvelle page au contrôle d’accès</summary>
            <form action={savePageAccessAction} className={styles.addForm}>
              <input type="hidden" name="id" value="" />
              <label>Nom<input name="label" required placeholder="Ex. Gestion des partenaires" /></label>
              <label>Catégorie<input name="category" required placeholder="Site et membres" /></label>
              <label>Chemin<input name="path_pattern" required placeholder="/dashboard/partenaires" /></label>
              <label>Ordre<input name="sort_order" type="number" defaultValue={600} /></label>
              <input type="hidden" name="active" value="on" />
              <div className={styles.roleMatrix}>
                {SECURITY_ROLE_OPTIONS.map((role) => (
                  <label key={role.key}>
                    <input type="checkbox" name={`role_${role.key}`} defaultChecked={role.key === "direction"} />
                    <span>{role.label}</span>
                  </label>
                ))}
              </div>
              <button className={styles.primaryButton} type="submit">Ajouter la page</button>
            </form>
          </details>

          <div className={styles.permissionList}>
            {filteredPages.map((page) => <PageAccessForm key={page.id} page={page} />)}
          </div>
        </div>
      )}

      {tab === "comptes" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div>
              <span>MEMBRES ET SÉCURITÉ</span>
              <h2>Accès Direction et blocage temporaire</h2>
              <p>Le blocage coupe immédiatement l’accès au site jusqu’à la date prévue.</p>
            </div>
            <input
              className={styles.search}
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Rechercher un citoyen…"
            />
          </div>

          <div className={styles.memberList}>
            {filteredMembers.map((member) => (
              <article className={styles.memberCard} key={member.user_id}>
                <div className={styles.memberIdentity}>
                  <strong>{member.display_name}</strong>
                  <span>{member.is_direction ? "Direction" : member.roles.map(roleLabel).join(" · ")}</span>
                  {member.blocked_until && (
                    <small>Bloqué jusqu’au {formatDate(member.blocked_until)} — {member.block_reason}</small>
                  )}
                </div>

                <div className={styles.memberActions}>
                  <form action={setDirectionAccessAction}>
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <input type="hidden" name="enabled" value={member.is_direction ? "false" : "true"} />
                    <button className={styles.secondaryButton} type="submit">
                      {member.is_direction ? "Retirer Direction" : "Donner accès Direction"}
                    </button>
                  </form>

                  {member.blocked_until ? (
                    <form action={unblockAccountAction} className={styles.inlineForm}>
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <input name="reason" required minLength={4} placeholder="Motif du déblocage" />
                      <button className={styles.successButton} type="submit">Débloquer</button>
                    </form>
                  ) : (
                    <form action={blockAccountAction} className={styles.inlineForm}>
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <select name="duration_hours" defaultValue="24">
                        <option value="1">1 heure</option>
                        <option value="6">6 heures</option>
                        <option value="24">24 heures</option>
                        <option value="72">3 jours</option>
                        <option value="168">7 jours</option>
                        <option value="720">30 jours</option>
                      </select>
                      <input name="reason" required minLength={4} placeholder="Motif obligatoire" />
                      <button className={styles.dangerButton} type="submit">Bloquer</button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "maintenance" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div>
              <span>MODE MAINTENANCE</span>
              <h2>Ouverture et fermeture du site</h2>
              <p>Les comptes Direction gardent l’accès pour pouvoir travailler et rouvrir le site.</p>
            </div>
          </div>
          <form action={updateSecuritySettingsAction} className={styles.settingsCard}>
            <label className={styles.bigSwitch}>
              <input
                type="checkbox"
                name="maintenance_enabled"
                defaultChecked={overview.settings.maintenance_enabled}
              />
              <span>
                <strong>Activer le mode maintenance</strong>
                <small>Les autres rôles sont envoyés vers une page d’information.</small>
              </span>
            </label>
            <label>
              Message affiché
              <textarea
                name="maintenance_message"
                rows={4}
                defaultValue={overview.settings.maintenance_message}
              />
            </label>
            <label className={styles.bigSwitch}>
              <input
                type="checkbox"
                name="require_delete_reason"
                defaultChecked={overview.settings.require_delete_reason}
              />
              <span>
                <strong>Motif obligatoire pour les suppressions importantes</strong>
                <small>Le motif est conservé dans le journal et dans la corbeille.</small>
              </span>
            </label>
            <div className={styles.twoColumns}>
              <label>
                Sauvegarde automatique toutes les
                <select name="backup_interval_hours" defaultValue={overview.settings.backup_interval_hours}>
                  <option value="6">6 heures</option>
                  <option value="12">12 heures</option>
                  <option value="24">24 heures</option>
                  <option value="48">48 heures</option>
                  <option value="168">7 jours</option>
                </select>
              </label>
              <label>
                Conservation de la corbeille
                <select name="trash_retention_days" defaultValue={overview.settings.trash_retention_days}>
                  <option value="7">7 jours</option>
                  <option value="15">15 jours</option>
                  <option value="30">30 jours</option>
                  <option value="60">60 jours</option>
                  <option value="90">90 jours</option>
                </select>
              </label>
            </div>
            <button className={styles.primaryButton} type="submit">Enregistrer les paramètres</button>
          </form>
        </div>
      )}

      {tab === "corbeille" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div>
              <span>RESTAURATION</span>
              <h2>Éléments supprimés</h2>
              <p>Une restauration remet les données dans leur table d’origine sans modifier les autres éléments.</p>
            </div>
            <span className={styles.counter}>{overview.trash.length} élément(s)</span>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Élément</th><th>Table</th><th>Suppression</th><th>Motif</th><th>Actions</th></tr></thead>
              <tbody>
                {overview.trash.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.display_label ?? item.source_id ?? "Élément"}</strong></td>
                    <td><code>{item.source_table}</code></td>
                    <td>{formatDate(item.deleted_at)}<small>{item.deleted_by_name ?? "Système"}</small></td>
                    <td>{item.deletion_reason ?? "Non renseigné"}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <form action={restoreTrashItemAction} className={styles.miniAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input name="reason" required minLength={4} placeholder="Motif restauration" />
                          <button className={styles.successButton} type="submit">Restaurer</button>
                        </form>
                        <form action={permanentlyDeleteTrashItemAction} className={styles.miniAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input name="reason" required minLength={4} placeholder="Motif définitif" />
                          <button className={styles.dangerButton} type="submit" data-deletion-reason-ready="true">Supprimer définitivement</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {overview.trash.length === 0 && <tr><td colSpan={5}>La corbeille est vide.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "sauvegardes" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div>
              <span>SAUVEGARDES JSON</span>
              <h2>Sauvegardes automatiques et manuelles</h2>
              <p>Les 20 sauvegardes les plus récentes sont conservées dans Supabase.</p>
            </div>
            <div className={styles.headerActions}>
              <form action={createBackupAction}><button className={styles.primaryButton}>Créer maintenant</button></form>
              <form action={refreshSecurityTriggersAction}><button className={styles.secondaryButton}>Actualiser les protections</button></form>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Tables</th><th>Lignes</th><th>Créée par</th><th>Fichier</th></tr></thead>
              <tbody>
                {overview.backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>{formatDate(backup.created_at)}</td>
                    <td>{backup.backup_kind}</td>
                    <td>{backup.table_count}</td>
                    <td>{backup.row_count.toLocaleString("fr-FR")}</td>
                    <td>{backup.created_by_name ?? "Système"}</td>
                    <td><a className={styles.downloadButton} href={`/api/security/backups/${backup.id}`}>Télécharger</a></td>
                  </tr>
                ))}
                {overview.backups.length === 0 && <tr><td colSpan={6}>Aucune sauvegarde pour le moment.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "connexions" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div><span>HISTORIQUE</span><h2>Connexions récentes</h2><p>Une entrée est créée par session active, avec un délai anti-doublon de 30 minutes.</p></div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Citoyen</th><th>Rôles</th><th>Date</th><th>Première page</th><th>Appareil</th><th>Empreinte IP</th></tr></thead>
              <tbody>
                {overview.logins.map((login) => (
                  <tr key={login.id}>
                    <td><strong>{login.display_name ?? "Compte Nostra"}</strong></td>
                    <td>{login.roles.map(roleLabel).join(" · ")}</td>
                    <td>{formatDate(login.logged_at)}</td>
                    <td><code>{login.first_path ?? "—"}</code></td>
                    <td className={styles.userAgent}>{login.user_agent ?? "Inconnu"}</td>
                    <td><code>{login.ip_hash ? `${login.ip_hash.slice(0, 12)}…` : "—"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "journal" && (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <div><span>JOURNAL PRÉCIS</span><h2>Modifications enregistrées</h2><p>Créations, modifications, suppressions, restaurations, blocages et changements de permissions.</p></div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Élément</th><th>Identifiant</th><th>Motif</th></tr></thead>
              <tbody>
                {overview.audit.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td><strong>{entry.actor_name ?? "Système"}</strong><small>{entry.actor_roles.map(roleLabel).join(" · ")}</small></td>
                    <td><span className={styles.actionBadge}>{entry.action_type}</span></td>
                    <td><code>{entry.entity_type}</code></td>
                    <td>{entry.entity_id ?? "—"}</td>
                    <td>{entry.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
