"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./discord-recruitment-announcement.module.css";

const DEFAULT_TITLE = "🚨 NOSTRA GROUP RECRUTE";
const DEFAULT_INTRO =
  "Nostra Group ouvre ses recrutements afin de renforcer ses équipes.";
const DEFAULT_POSITIONS = [
  "Commercial Nostra Motors",
  "Employé Nostra Motors",
  "Commissaire de course",
].join("\n");
const DEFAULT_REQUIREMENTS = [
  "Être sérieux et motivé",
  "Être actif sur le serveur",
  "Respecter le règlement et l’image de Nostra Group",
].join("\n");
const DEFAULT_ENDING =
  "Pour déposer ta candidature, utilise le lien ci-dessous :";

function toDiscordBulletList(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join("\n");
}

export function DiscordRecruitmentAnnouncement() {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [ending, setEnding] = useState(DEFAULT_ENDING);
  const [recruitmentUrl, setRecruitmentUrl] = useState("/recrutement");
  const [includeEveryone, setIncludeEveryone] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  useEffect(() => {
    setRecruitmentUrl(`${window.location.origin}/recrutement`);
  }, []);

  const announcement = useMemo(() => {
    const sections: string[] = [];

    if (includeEveryone) sections.push("@everyone");
    sections.push(`# ${title.trim() || DEFAULT_TITLE}`);

    if (intro.trim()) sections.push(intro.trim());

    const formattedPositions = toDiscordBulletList(positions);
    if (formattedPositions) {
      sections.push(`**Postes disponibles :**\n${formattedPositions}`);
    }

    const formattedRequirements = toDiscordBulletList(requirements);
    if (formattedRequirements) {
      sections.push(`**Profils recherchés :**\n${formattedRequirements}`);
    }

    if (ending.trim()) sections.push(ending.trim());
    if (recruitmentUrl.trim()) sections.push(recruitmentUrl.trim());

    return sections.join("\n\n");
  }, [ending, includeEveryone, intro, positions, recruitmentUrl, requirements, title]);

  async function copyAnnouncement() {
    try {
      await navigator.clipboard.writeText(announcement);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
    }
  }

  function resetAnnouncement() {
    setTitle(DEFAULT_TITLE);
    setIntro(DEFAULT_INTRO);
    setPositions(DEFAULT_POSITIONS);
    setRequirements(DEFAULT_REQUIREMENTS);
    setEnding(DEFAULT_ENDING);
    setRecruitmentUrl(`${window.location.origin}/recrutement`);
    setIncludeEveryone(false);
    setCopyState("idle");
  }

  return (
    <section className={styles.layout}>
      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className="eyebrow">CRÉATION</span>
            <h2>Contenu de l’annonce</h2>
          </div>
          <span className={styles.noWebhook}>Copier / coller</span>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Titre</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
            />
          </label>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Introduction</span>
            <textarea
              value={intro}
              onChange={(event) => setIntro(event.target.value)}
              rows={3}
              maxLength={500}
            />
          </label>

          <label className={styles.field}>
            <span>Postes disponibles</span>
            <small>Un poste par ligne</small>
            <textarea
              value={positions}
              onChange={(event) => setPositions(event.target.value)}
              rows={7}
            />
          </label>

          <label className={styles.field}>
            <span>Profils recherchés</span>
            <small>Un critère par ligne</small>
            <textarea
              value={requirements}
              onChange={(event) => setRequirements(event.target.value)}
              rows={7}
            />
          </label>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Phrase avant le lien</span>
            <input
              value={ending}
              onChange={(event) => setEnding(event.target.value)}
              maxLength={250}
            />
          </label>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Lien de la page recrutement</span>
            <input
              type="url"
              value={recruitmentUrl}
              onChange={(event) => setRecruitmentUrl(event.target.value)}
              placeholder="https://ton-site.fr/recrutement"
            />
          </label>
        </div>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={includeEveryone}
            onChange={(event) => setIncludeEveryone(event.target.checked)}
          />
          <span>
            Ajouter <strong>@everyone</strong> au début de l’annonce
          </span>
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={copyAnnouncement}
          >
            {copyState === "copied"
              ? "✓ Annonce copiée"
              : "Copier l’annonce Discord"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={resetAnnouncement}
          >
            Réinitialiser
          </button>
        </div>

        {copyState === "error" && (
          <p className={styles.errorMessage}>
            La copie automatique a été bloquée par le navigateur. Sélectionne
            le texte dans l’aperçu puis copie-le manuellement.
          </p>
        )}
      </article>

      <article className={`${styles.panel} ${styles.previewPanel}`}>
        <div className={styles.panelHeading}>
          <div>
            <span className="eyebrow">APERÇU</span>
            <h2>Message Discord</h2>
          </div>
          <span className={styles.characterCount}>
            {announcement.length.toLocaleString("fr-FR")} caractères
          </span>
        </div>

        <pre className={styles.preview}>{announcement}</pre>

        <p className={styles.helperText}>
          Clique sur « Copier l’annonce Discord », ouvre le salon souhaité du
          serveur puis colle le message. Le lien vers le recrutement sera
          cliquable automatiquement.
        </p>
      </article>
    </section>
  );
}
