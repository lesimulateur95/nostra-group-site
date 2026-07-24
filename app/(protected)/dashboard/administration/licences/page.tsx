import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  normalizeCircuitLicenceCategory,
  normalizeCircuitLicenceName,
} from "@/lib/licenses/naming";
import { createClient } from "@/lib/supabase/server";

import styles from "./licences.module.css";

type Citizen = {
  user_id: string;
  display_name: string;
  email: string | null;
  discord_name: string | null;
};

type License = {
  id: string;
  holder_user_id: string;
  holder_name: string;
  holder_email: string | null;
  licence_number: string;
  licence_name: string;
  category: string | null;
  status: string;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
};

type SearchParams = Promise<{
  success?: string;
  error?: string;
  licence?: string;
  sent?: string;
  deleted?: string;
}>;

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Le formulaire envoie du texte libre. Le wrapper SQL V74 détecte le type
 * réel attendu par la fonction historique et effectue lui-même la conversion
 * JSON sans jamais laisser PostgreSQL interpréter le texte utilisateur.
 */
function formatDate(value: string | null): string {
  if (!value) return "Sans expiration";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00`));
}

async function deleteLicence(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const licenceId = stringValue(formData.get("licence_id"));

  if (!licenceId) {
    redirect(
      "/dashboard/administration/licences?error=" +
        encodeURIComponent("La licence à supprimer est introuvable."),
    );
  }

  const { error } = await supabase.rpc("delete_nostra_licence", {
    p_licence_id: licenceId,
  });

  if (error) {
    redirect(
      "/dashboard/administration/licences?error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/administration/licences");
  revalidatePath("/profil/documents");
  redirect("/dashboard/administration/licences?deleted=1");
}

async function issueLicence(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const holderUserId = stringValue(formData.get("holder_user_id"));
  const licenceName = normalizeCircuitLicenceName(
    stringValue(formData.get("licence_name")),
  );
  const category = normalizeCircuitLicenceCategory(
    licenceName,
    stringValue(formData.get("category")),
  );
  const authority =
    stringValue(formData.get("authority")) || "Direction Nostra Group";
  const validFrom = stringValue(formData.get("valid_from"));
  const validUntil = stringValue(formData.get("valid_until"));
  const permissions = stringValue(formData.get("permissions"));
  const notes = stringValue(formData.get("notes"));
  const sendToCitizen = formData.get("send_to_citizen") === "on";

  if (!holderUserId || !licenceName || !validFrom) {
    redirect(
      "/dashboard/administration/licences?error=" +
        encodeURIComponent(
          "Le citoyen, le nom de la licence et la date de début sont obligatoires.",
        ),
    );
  }

  const { data: licenceId, error } = await supabase.rpc(
    "issue_nostra_licence_safe_v74",
    {
      p_holder_user_id: holderUserId,
      p_licence_name: licenceName,
      p_category: category,
      p_authority: authority,
      p_valid_from: validFrom,
      p_valid_until: validUntil || null,
      p_permissions: permissions || null,
      p_notes: notes || null,
      p_send_to_citizen: sendToCitizen,
    },
  );

  if (error) {
    const errorMessage = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" — ");

    redirect(
      "/dashboard/administration/licences?error=" +
        encodeURIComponent(errorMessage),
    );
  }

  revalidatePath("/dashboard/administration/licences");
  revalidatePath("/profil/documents");
  revalidatePath("/profil/licences");

  const query = new URLSearchParams({
    success: "1",
    licence: String(licenceId ?? ""),
  });

  if (sendToCitizen) query.set("sent", "1");

  redirect(`/dashboard/administration/licences?${query.toString()}`);
}

export default async function LicenceAdministrationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const [citizensResult, licencesResult] = await Promise.all([
    supabase.rpc("list_nostra_licence_citizens"),
    supabase
      .from("nostra_licences")
      .select(
        "id, holder_user_id, holder_name, holder_email, licence_number, licence_name, category, status, valid_from, valid_until, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const configured = !citizensResult.error && !licencesResult.error;
  const citizens = (citizensResult.data ?? []) as Citizen[];
  const licences = (licencesResult.data ?? []) as License[];

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>DIRECTION · ADMINISTRATION</span>
            <h1>Générateur de licences</h1>
            <p>
              Sélectionne un citoyen, choisis un modèle existant ou saisis
              librement n’importe quel type de licence. Le numéro officiel est
              créé automatiquement, la licence est enregistrée et un document
              imprimable est immédiatement disponible.
            </p>
          </div>

          <Link className={styles.backLink} href="/dashboard">
            ← Retour au Dashboard
          </Link>
        </section>

        {params.error && <div className={styles.error}>{params.error}</div>}

        {params.success && (
          <div className={styles.success}>
            Licence générée et enregistrée avec succès.
            {params.sent
              ? " Elle a aussi été envoyée dans les documents du citoyen."
              : ""}
            {params.licence ? (
              <>
                {" "}
                <Link
                  className={styles.printLink}
                  href={`/dashboard/administration/licences/${params.licence}/imprimer`}
                >
                  Ouvrir le document
                </Link>
              </>
            ) : null}
          </div>
        )}

        {params.deleted && (
          <div className={styles.success}>
            Licence supprimée du registre. Sa copie éventuelle a aussi été
            retirée des Documents & factures du citoyen.
          </div>
        )}

        {!configured ? (
          <section className={styles.panel}>
            <span className={styles.eyebrow}>ACTIVATION SUPABASE REQUISE</span>
            <h2>Le module des licences n’est pas encore activé</h2>
            <p className={styles.panelIntro}>
              Exécute les migrations Supabase du générateur de licences, puis
              recharge cette page.
            </p>
          </section>
        ) : (
          <>
            <section className={styles.layout}>
              <article className={styles.panel}>
                <span className={styles.eyebrow}>NOUVELLE LICENCE</span>
                <h2>Générer un document officiel</h2>
                <p className={styles.panelIntro}>
                  Tous les champs restent modifiables pour pouvoir créer une
                  licence pilote, professionnelle, temporaire ou totalement
                  personnalisée.
                </p>

                <form className={styles.form} action={issueLicence}>
                  <div className={styles.field}>
                    <label htmlFor="holder_user_id">
                      Citoyen bénéficiaire *
                    </label>
                    <select
                      id="holder_user_id"
                      name="holder_user_id"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Sélectionner un citoyen
                      </option>
                      {citizens.map((citizen) => (
                        <option key={citizen.user_id} value={citizen.user_id}>
                          {citizen.display_name}
                        </option>
                      ))}
                    </select>
                    <small>{citizens.length} citoyen(s) disponible(s).</small>
                  </div>

                  <div className={styles.gridTwo}>
                    <div className={styles.field}>
                      <label htmlFor="licence_name">Type de licence *</label>
                      <input
                        id="licence_name"
                        name="licence_name"
                        list="licence-types"
                        placeholder="Ex. Licence Circuit, GT3 RS ou F1"
                        required
                      />
                      <datalist id="licence-types">
                        <option value="Licence Circuit" />
                        <option value="Licence F1" />
                        <option value="Licence GT3 RS" />
                        <option value="Licence pilote catégorie C" />
                        <option value="Licence commissaire de piste" />
                        <option value="Licence directeur de course" />
                        <option value="Licence mécanicien" />
                        <option value="Licence ingénieur d’écurie" />
                        <option value="Licence écurie" />
                        <option value="Licence professionnelle" />
                        <option value="Autorisation temporaire" />
                        <option value="Accréditation événement" />
                      </datalist>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="category">Catégorie / niveau</label>
                      <input
                        id="category"
                        name="category"
                        placeholder="Ex. F1, GT3 RS, C, Premium…"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="authority">Autorité émettrice</label>
                    <input
                      id="authority"
                      name="authority"
                      defaultValue="Direction Nostra Group"
                    />
                  </div>

                  <div className={styles.gridTwo}>
                    <div className={styles.field}>
                      <label htmlFor="valid_from">Valable à partir du *</label>
                      <input
                        id="valid_from"
                        name="valid_from"
                        type="date"
                        defaultValue={today}
                        required
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="valid_until">Date d’expiration</label>
                      <input
                        id="valid_until"
                        name="valid_until"
                        type="date"
                      />
                      <small>Laisse vide pour une licence sans expiration.</small>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="permissions">
                      Droits et autorisations accordés
                    </label>
                    <textarea
                      id="permissions"
                      name="permissions"
                      placeholder="Ex. Autorisé à participer aux compétitions officielles, accès paddock et voie des stands…"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="notes">Observations internes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      placeholder="Informations complémentaires visibles dans le registre et sur le document."
                    />
                  </div>

                  <label className={styles.deliveryOption}>
                    <input type="checkbox" name="send_to_citizen" />
                    <span>
                      <strong>Envoyer cette licence au citoyen</strong>
                      <small>
                        La licence sera ajoutée immédiatement dans la section
                        Documents & factures de son profil.
                      </small>
                    </span>
                  </label>

                  <button className={styles.submit} type="submit">
                    Générer automatiquement la licence
                  </button>
                </form>
              </article>

              <aside className={styles.panel}>
                <span className={styles.eyebrow}>FONCTIONNEMENT</span>
                <h2>Création automatique</h2>
                <p className={styles.panelIntro}>
                  Le module utilise directement les citoyens inscrits sur le
                  site et évite toute ressaisie de leur identité.
                </p>
                <ol className={styles.steps}>
                  <li>
                    <span>1</span>
                    <div>Sélection du citoyen depuis les profils du site.</div>
                  </li>
                  <li>
                    <span>2</span>
                    <div>Choix libre du type, de la catégorie et de la durée.</div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>Création automatique d’un numéro officiel unique.</div>
                  </li>
                  <li>
                    <span>4</span>
                    <div>
                      Enregistrement dans le registre sécurisé de la Direction.
                    </div>
                  </li>
                  <li>
                    <span>5</span>
                    <div>Envoi facultatif dans les documents du citoyen.</div>
                  </li>
                </ol>
              </aside>
            </section>

            <section className={styles.history}>
              <div className={styles.historyHeader}>
                <div>
                  <span className={styles.eyebrow}>REGISTRE</span>
                  <h2>Licences déjà générées</h2>
                  <p>Les 100 dernières licences sont affichées ici.</p>
                </div>
                <span className={styles.notice}>
                  {licences.length} licence(s)
                </span>
              </div>

              {licences.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Numéro</th>
                        <th>Citoyen</th>
                        <th>Licence</th>
                        <th>Validité</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licences.map((licence) => (
                        <tr key={licence.id}>
                          <td className={styles.number}>
                            {licence.licence_number}
                          </td>
                          <td>
                            <strong>{licence.holder_name}</strong>
                          </td>
                          <td>
                            <strong>{licence.licence_name}</strong>
                            {licence.category ? (
                              <>
                                <br />
                                Catégorie {licence.category}
                              </>
                            ) : null}
                          </td>
                          <td>
                            {formatDate(licence.valid_from)}
                            <br />
                            au {formatDate(licence.valid_until)}
                          </td>
                          <td>
                            <span className={styles.status}>
                              {licence.status}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <Link
                                className={styles.printLink}
                                href={`/dashboard/administration/licences/${licence.id}/imprimer`}
                              >
                                Ouvrir
                              </Link>
                              <form
                                className={styles.deleteForm}
                                action={deleteLicence}
                              >
                                <input
                                  type="hidden"
                                  name="licence_id"
                                  value={licence.id}
                                />
                                <button
                                  className={styles.deleteButton}
                                  type="submit"
                                  aria-label={`Supprimer la licence ${licence.licence_number}`}
                                >
                                  Supprimer
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.empty}>
                  Aucune licence générée pour le moment.
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
