
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteTeamMailThread,
  openTeamMailThread,
  replyToMail,
  sendTeamMailToCitizen,
} from "@/app/actions/mail";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getCitizenMailboxes,
  getTeamMailMessages,
  getTeamMailThread,
  getUnreadTeamMailCount,
} from "@/lib/mail/data";
import { createClient } from "@/lib/supabase/server";
import { MAIL_SETUP_SQL } from "@/lib/mail/setup-sql";
import styles from "@/components/mail/mail.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export default async function TeamMailboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    folder?: string;
    thread?: string;
    sent?: string;
    replied?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const allowed =
    roles.includes("manager") ||
    roles.includes("employee") ||
    roles.includes("commercial");

  if (!allowed) redirect("/accueil");

  const params = await searchParams;
  const folder = params.folder === "sent" ? "sent" : "inbox";
  const overview = await getUnreadTeamMailCount();

  if (!overview.configured) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>COMMUNICATION NOSTRA GROUP</span>
            <h1>Messagerie de l’équipe</h1>
          </div>
          <Link className={styles.backButton} href="/dashboard">
            ← Retour au Dashboard
          </Link>
        </header>

        <section className={styles.setup}>
          <h2>Activation V35 nécessaire</h2>
          <p>
            Copie tout le SQL ci-dessous dans Supabase → SQL Editor → New
            query, puis clique sur Run.
          </p>
          <details>
            <summary>Afficher le SQL V35</summary>
            <pre>{MAIL_SETUP_SQL}</pre>
          </details>
        </section>
      </main>
    );
  }

  const [messages, citizens] = await Promise.all([
    getTeamMailMessages(folder),
    getCitizenMailboxes(),
  ]);
  const selectedThread = params.thread
    ? await getTeamMailThread(params.thread)
    : [];
  const selectedMessage = selectedThread[0] ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMMUNICATION NOSTRA GROUP</span>
          <h1>Messagerie de l’équipe</h1>
          <p>
            Reçois les demandes des citoyens et réponds depuis l’adresse
            officielle de l’équipe.
          </p>
        </div>
        <Link className={styles.backButton} href="/dashboard">
          ← Retour au Dashboard
        </Link>
      </header>

      <section className={styles.mailboxBar}>
        <div>
          <span>ADRESSE DE L’ÉQUIPE</span>
          <strong>equipe@nostra.group</strong>
        </div>
        <div>
          <span>MESSAGES NON LUS</span>
          <strong>{overview.unread}</strong>
        </div>
      </section>

      {params.sent && (
        <p className={styles.feedback}>
          Le message officiel a été envoyé au citoyen.
        </p>
      )}
      {params.replied && (
        <p className={styles.feedback}>La réponse a été envoyée.</p>
      )}
      {params.deleted && (
        <p className={styles.feedback}>
          La conversation a été supprimée de la boîte de l’équipe.
        </p>
      )}
      {params.error && (
        <p className={`${styles.feedback} ${styles.feedbackError}`}>
          Le message n’a pas pu être envoyé.
        </p>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav className={styles.tabs}>
            <Link
              className={folder === "inbox" ? styles.activeTab : ""}
              href="/dashboard/messagerie"
            >
              Reçus
            </Link>
            <Link
              className={folder === "sent" ? styles.activeTab : ""}
              href="/dashboard/messagerie?folder=sent"
            >
              Envoyés
            </Link>
          </nav>

          <div className={styles.messageList}>
            {messages.length === 0 && (
              <p className={styles.empty}>Aucun message dans ce dossier.</p>
            )}

            {messages.map((message) => (
              <form action={openTeamMailThread} key={message.message_id}>
                <input
                  type="hidden"
                  name="thread_id"
                  value={message.thread_id}
                />
                <button
                  className={`${styles.messageButton} ${
                    !message.read_at && message.direction === "inbox"
                      ? styles.unreadMessage
                      : ""
                  } ${
                    params.thread === message.thread_id
                      ? styles.selectedMessage
                      : ""
                  }`}
                  type="submit"
                >
                  <span className={styles.messageTop}>
                    <strong>
                      {folder === "inbox"
                        ? message.sender_name
                        : message.recipient_name}
                    </strong>
                    <time>{formatDate(message.created_at)}</time>
                  </span>
                  <span className={styles.subject}>{message.subject}</span>
                  <span className={styles.preview}>{message.body}</span>
                </button>
              </form>
            ))}
          </div>
        </aside>

        <section className={styles.mainColumn}>
          <article className={styles.composePanel}>
            <h2>Écrire à un citoyen</h2>
            <p>
              Le message sera envoyé depuis equipe@nostra.group.
            </p>

            <form action={sendTeamMailToCitizen} className={styles.form}>
              <label>
                Destinataire
                <select name="recipient_mailbox_id" required defaultValue="">
                  <option value="" disabled>
                    Choisir un citoyen
                  </option>
                  {citizens.map((citizen) => (
                    <option
                      key={citizen.mailbox_id}
                      value={citizen.mailbox_id}
                    >
                      {citizen.display_name} — {citizen.address}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sujet
                <input
                  name="subject"
                  minLength={3}
                  maxLength={180}
                  required
                  placeholder="Exemple : information concernant votre commande"
                />
              </label>

              <label>
                Message
                <textarea
                  name="body"
                  minLength={3}
                  maxLength={5000}
                  required
                  rows={6}
                  placeholder="Écris le message officiel…"
                />
              </label>

              <button className={styles.submitButton} type="submit">
                Envoyer au citoyen
              </button>
            </form>
          </article>

          <article className={styles.threadPanel}>
            {!selectedMessage ? (
              <p className={styles.empty}>
                Sélectionne un message pour afficher la conversation.
              </p>
            ) : (
              <>
                <header className={styles.threadHeader}>
                  <div className={styles.threadHeaderTop}>
                    <div>
                      <span>CONVERSATION</span>
                      <h2>{selectedMessage.subject}</h2>
                      <span>
                        {selectedThread.length} message
                        {selectedThread.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <form action={deleteTeamMailThread}>
                      <input
                        type="hidden"
                        name="thread_id"
                        value={selectedMessage.thread_id}
                      />
                      <button
                        className={styles.deleteThreadButton}
                        type="submit"
                      >
                        Supprimer la conversation
                      </button>
                    </form>
                  </div>
                </header>

                <div className={styles.threadMessages}>
                  {selectedThread.map((message) => (
                    <article
                      className={`${styles.bubble} ${
                        message.direction === "sent"
                          ? styles.bubbleOutgoing
                          : styles.bubbleIncoming
                      }`}
                      key={message.message_id}
                    >
                      <div className={styles.bubbleMeta}>
                        <strong>{message.sender_name}</strong>
                        <time>{formatDate(message.created_at)}</time>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  ))}
                </div>

                <form action={replyToMail} className={styles.form}>
                  <input
                    type="hidden"
                    name="thread_id"
                    value={selectedMessage.thread_id}
                  />
                  <input type="hidden" name="context" value="team" />
                  <label>
                    Répondre depuis equipe@nostra.group
                    <textarea
                      name="body"
                      minLength={2}
                      maxLength={5000}
                      required
                      rows={4}
                      placeholder="Écris la réponse…"
                    />
                  </label>
                  <button className={styles.submitButton} type="submit">
                    Envoyer la réponse
                  </button>
                </form>
              </>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
