
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  closeDealEdition,
  createDealEdition,
  stopDealSession,
  triggerDealBankerCall,
} from "@/app/actions/deal-game";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getDealDashboardState,
  getDealModuleConfigured,
} from "@/lib/deal/data";
import { DEAL_SETUP_SQL } from "@/lib/deal/setup-sql";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  choosing: "Choix de la boîte",
  playing: "En cours",
  banker_call: "Appel du banquier",
  accepted: "Offre acceptée",
  final: "Terminée",
  stopped: "Arrêtée",
};

export default async function DealDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    called?: string;
    stopped?: string;
    closed?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const params = await searchParams;
  const configured = await getDealModuleConfigured();
  const state = configured
    ? await getDealDashboardState()
    : { edition: null, sessions: [] };

  return (
    <DashboardShell>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>JEUX NOSTRA GROUP</span>
            <h1>À Prendre ou à Laisser</h1>
            <p>
              Crée l’édition, surveille chaque joueur en direct et
              déclenche toi-même les appels du banquier.
            </p>
          </div>
          <Link className={styles.backButton} href="/dashboard">
            ← Retour au Dashboard
          </Link>
        </header>

        {!configured && (
          <section className={styles.setup}>
            <span>ACTIVATION V36</span>
            <h2>Activer le jeu</h2>
            <p>
              Copie tout le SQL ci-dessous dans Supabase → SQL Editor
              → New query, puis clique sur Run.
            </p>
            <details>
              <summary>Afficher le SQL V36</summary>
              <pre>{DEAL_SETUP_SQL}</pre>
            </details>
          </section>
        )}

        {params.created && (
          <p className={styles.success}>
            La nouvelle édition est ouverte.
          </p>
        )}
        {params.called && (
          <p className={styles.success}>
            L’appel du banquier est affiché chez le joueur.
          </p>
        )}
        {params.stopped && (
          <p className={styles.success}>La partie a été arrêtée.</p>
        )}
        {params.closed && (
          <p className={styles.success}>
            L’édition est maintenant fermée.
          </p>
        )}
        {params.error && (
          <p className={styles.error}>
            L’action n’a pas pu être enregistrée.
            {params.error === "prizes"
              ? " La liste manuelle doit contenir exactement 24 gains, un par ligne."
              : params.error === "offer"
                ? " Écris l’offre du banquier avant de déclencher l’appel."
                : ""}
          </p>
        )}

        {configured && (
          <>
            <section className={styles.createPanel}>
              <div>
                <span className={styles.sectionLabel}>
                  CRÉER UNE NOUVELLE ÉDITION
                </span>
                <h2>24 boîtes et 24 gains</h2>
                <p>
                  Une nouvelle édition ferme automatiquement l’ancienne.
                  Tu peux utiliser les gains générés par le site ou
                  saisir exactement 24 cadeaux.
                </p>
              </div>

              <form action={createDealEdition} className={styles.form}>
                <label>
                  Nom de l’édition
                  <input
                    name="title"
                    maxLength={120}
                    defaultValue="À Prendre ou à Laisser"
                  />
                </label>

                <label>
                  Liste manuelle — un cadeau par ligne
                  <textarea
                    name="prizes"
                    rows={12}
                    maxLength={8000}
                    placeholder={`1 café offert
Peinture offerte
25 000 €
...
24e cadeau`}
                  />
                </label>

                <div className={styles.createActions}>
                  <button
                    className={styles.primaryButton}
                    name="mode"
                    type="submit"
                    value="manual"
                  >
                    Créer avec mes 24 gains
                  </button>
                  <button
                    className={styles.secondaryButton}
                    name="mode"
                    type="submit"
                    value="random"
                  >
                    Générer les gains automatiquement
                  </button>
                </div>
              </form>
            </section>

            {!state.edition && (
              <section className={styles.empty}>
                <h2>Aucune édition ouverte</h2>
                <p>
                  Utilise le formulaire ci-dessus pour lancer le jeu.
                </p>
              </section>
            )}

            {state.edition && (
              <>
                <section className={styles.editionHeader}>
                  <div>
                    <span className={styles.sectionLabel}>
                      ÉDITION EN COURS
                    </span>
                    <h2>{state.edition.title}</h2>
                    <p>
                      {state.sessions.length} partie
                      {state.sessions.length > 1 ? "s" : ""} créée
                      {state.sessions.length > 1 ? "s" : ""}.
                    </p>
                  </div>

                  <form action={closeDealEdition}>
                    <button
                      className={styles.dangerButton}
                      type="submit"
                    >
                      Fermer l’édition
                    </button>
                  </form>
                </section>

                <section className={styles.prizeList}>
                  {state.edition.prize_labels.map((prize, index) => (
                    <article key={`${index}-${prize}`}>
                      <span>{index + 1}</span>
                      <strong>{prize}</strong>
                    </article>
                  ))}
                </section>

                <section className={styles.sessions}>
                  <div className={styles.sessionsHeading}>
                    <span className={styles.sectionLabel}>
                      PARTIES EN DIRECT
                    </span>
                    <h2>Joueurs et appels du banquier</h2>
                  </div>

                  {state.sessions.length === 0 && (
                    <p className={styles.empty}>
                      Aucun citoyen n’a encore commencé sa partie.
                    </p>
                  )}

                  {state.sessions.map((session) => (
                    <article
                      className={styles.sessionCard}
                      key={session.id}
                    >
                      <header className={styles.sessionHeader}>
                        <div>
                          <span
                            className={`${styles.status} ${
                              session.status === "banker_call"
                                ? styles.calling
                                : ""
                            }`}
                          >
                            {statusLabels[session.status] ??
                              session.status}
                          </span>
                          <h3>{session.player_name}</h3>
                          <p>
                            Boîte conservée :{" "}
                            <strong>
                              {session.selected_box ?? "Pas encore choisie"}
                            </strong>
                            {" · "}
                            {session.opened_count} boîte
                            {session.opened_count > 1 ? "s" : ""} ouverte
                            {session.opened_count > 1 ? "s" : ""}
                          </p>
                        </div>

                        <div className={styles.sessionResult}>
                          {session.final_reward && (
                            <>
                              <span>GAIN FINAL</span>
                              <strong>{session.final_reward}</strong>
                            </>
                          )}
                        </div>
                      </header>

                      <details className={styles.liveDetails}>
                        <summary>
                          Voir les 24 boîtes et leur contenu
                        </summary>
                        <div className={styles.liveBoxes}>
                          {session.boxes.map((box) => (
                            <div
                              className={`${styles.liveBox} ${
                                box.opened ? styles.liveBoxOpened : ""
                              } ${
                                session.selected_box === box.box_number
                                  ? styles.liveBoxSelected
                                  : ""
                              }`}
                              key={box.box_number}
                            >
                              <span>Boîte {box.box_number}</span>
                              <strong>{box.prize_label}</strong>
                              <small>
                                {session.selected_box === box.box_number
                                  ? "Boîte du joueur"
                                  : box.opened
                                    ? "Ouverte"
                                    : "Fermée"}
                              </small>
                            </div>
                          ))}
                        </div>
                      </details>

                      {(session.status === "playing" ||
                        session.status === "banker_call") && (
                        <div className={styles.sessionActions}>
                          {session.status === "playing" && (
                            <form
                              action={triggerDealBankerCall}
                              className={styles.bankerForm}
                            >
                              <input
                                type="hidden"
                                name="session_id"
                                value={session.id}
                              />
                              <label>
                                Cadeau ou offre proposée par le banquier
                                <input
                                  name="offer"
                                  minLength={2}
                                  maxLength={500}
                                  required
                                  placeholder="Exemple : 185 000 € ou une Lamborghini surprise"
                                />
                              </label>
                              <button
                                className={styles.callButton}
                                type="submit"
                              >
                                ☎ Déclencher l’appel du banquier
                              </button>
                            </form>
                          )}

                          {session.status === "banker_call" && (
                            <div className={styles.pendingOffer}>
                              <span>APPEL AFFICHÉ CHEZ LE JOUEUR</span>
                              <strong>{session.banker_offer}</strong>
                              <p>
                                Le joueur doit choisir « À prendre » ou
                                « À laisser ».
                              </p>
                            </div>
                          )}

                          <form action={stopDealSession}>
                            <input
                              type="hidden"
                              name="session_id"
                              value={session.id}
                            />
                            <button
                              className={styles.dangerButton}
                              type="submit"
                            >
                              Arrêter cette partie
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </DashboardShell>
  );
}
