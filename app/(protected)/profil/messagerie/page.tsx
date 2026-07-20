
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteMyMailThread,
  openMyMailThread,
  replyToMail,
  sendMailToNostra,
} from "@/app/actions/mail";
import {
  getMyMailboxOverview,
  getMyMailMessages,
  getMyMailThread,
} from "@/lib/mail/data";
import { createClient } from "@/lib/supabase/server";
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

export default async function CitizenMailboxPage({
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

  const params = await searchParams;
  const folder = params.folder === "sent" ? "sent" : "inbox";
  const overview = await getMyMailboxOverview();

  if (!overview.configured || !overview.mailbox) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>MESSAGERIE INTERNE</span>
            <h1>Ma boîte mail</h1>
          </div>
          <Link className={styles.backButton} href="/profil">
            ← Retour à mon profil
          </Link>
        </header>

        <section className={styles.setup}>
          <h2>Activation V35 nécessaire</h2>
          <p>
            Le Gérant doit exécuter le SQL V35 dans Supabase avant que les
            adresses internes puissent être créées.
          </p>
        </section>
      </main>
    );
  }

  const messages = await getMyMailMessages(folder);
  const selectedThread = params.thread
    ? await getMyMailThread(params.thread)
    : [];
  const selectedMessage = selectedThread[0] ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>MESSAGERIE INTERNE</span>
          <h1>Ma boîte mail</h1>
          <p>
            Contacte directement l’équipe Nostra Group et retrouve toutes ses
            réponses dans ton espace privé.
          </p>
        </div>
        <Link className={styles.backButton} href="/profil">
          ← Retour à mon profil
        </Link>
      </header>

      <section className={styles.mailboxBar}>
        <div>
          <span>MON ADRESSE INTERNE</span>
          <strong>{overview.mailbox.address}</strong>
        </div>
        <div>
          <span>MESSAGES NON LUS</span>
          <strong>{overview.unread}</strong>
        </div>
      </section>

      {params.sent && (
        <p className={styles.feedback}>Ton message a été envoyé à l’équipe.</p>
      )}
      {params.replied && (
        <p className={styles.feedback}>Ta réponse a été envoyée.</p>
      )}
      {params.deleted && (
        <p className={styles.feedback}>
          La conversation a été supprimée de ta boîte mail.
        </p>
      )}
      {params.error && (
        <p className={`${styles.feedback} ${styles.feedbackError}`}>
          Le message n’a pas pu être envoyé. Vérifie le sujet et le contenu.
        </p>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav className={styles.tabs}>
            <Link
              className={folder === "inbox" ? styles.activeTab : ""}
              href="/profil/messagerie"
            >
              Reçus
            </Link>
            <Link
              className={folder === "sent" ? styles.activeTab : ""}
              href="/profil/messagerie?folder=sent"
            >
              Envoyés
            </Link>
          </nav>

          <div className={styles.messageList}>
            {messages.length === 0 && (
              <p className={styles.empty}>Aucun message dans ce dossier.</p>
            )}

            {messages.map((message) => (
              <form action={openMyMailThread} key={message.message_id}>
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
            <h2>Écrire à l’équipe Nostra Group</h2>
            <p>
              Ton message arrivera dans la messagerie partagée de l’équipe.
            </p>

            <form action={sendMailToNostra} className={styles.form}>
              <label>
                Sujet
                <input
                  name="subject"
                  minLength={3}
                  maxLength={180}
                  required
                  placeholder="Exemple : question sur ma commande"
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
                  placeholder="Écris ton message…"
                />
              </label>

              <button className={styles.submitButton} type="submit">
                Envoyer à Nostra Group
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
                        Avec l’équipe Nostra Group ·{" "}
                        {selectedThread.length} message
                        {selectedThread.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <form action={deleteMyMailThread}>
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
                  <input type="hidden" name="context" value="citizen" />
                  <label>
                    Répondre
                    <textarea
                      name="body"
                      minLength={2}
                      maxLength={5000}
                      required
                      rows={4}
                      placeholder="Écris ta réponse…"
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

      <p className={styles.internalNotice}>
        Cette adresse est une messagerie interne au site Nostra Group. Elle ne
        reçoit pas les e-mails provenant de Gmail, Outlook ou d’autres services
        externes.
      </p>
    </main>
  );
}
