import {
  addTreasureHuntClue,
  createTreasureHunt,
  deleteTreasureHunt,
  deleteTreasureHuntClue,
  moveTreasureHuntClue,
  revealNextTreasureHuntClue,
  setTreasureHuntEnabled,
  updateTreasureHunt,
  updateTreasureHuntClue,
} from "@/app/actions/treasure-hunt";
import type { TreasureHunt } from "@/lib/treasure-hunt/data";
import styles from "./treasure-hunt.module.css";

function localDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function statusLabel(status: TreasureHunt["status"]): string {
  return {
    draft: "Brouillon",
    published: "Publiée",
    completed: "Terminée",
    cancelled: "Annulée",
  }[status];
}

const uploadHelpStyle = {
  display: "block",
  marginTop: "0.35rem",
  color: "rgba(255,255,255,0.62)",
  fontSize: "0.78rem",
} as const;

const previewStyle = {
  display: "block",
  width: "min(100%, 520px)",
  maxHeight: "280px",
  marginTop: "0.65rem",
  objectFit: "contain",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.35)",
  background: "#090909",
} as const;

export function TreasureHuntAdmin({
  hunts,
  enabled,
  success,
  error,
}: {
  hunts: TreasureHunt[];
  enabled: boolean;
  success?: string;
  error?: string;
}) {
  return (
    <div className={styles.adminPage}>
      {success && (
        <div className={styles.notice}>La chasse au trésor a bien été mise à jour.</div>
      )}
      {error && <div className={styles.error}>{error}</div>}

      <section className={`${styles.panel} ${styles.activationPanel}`}>
        <div>
          <p className="eyebrow">AFFICHAGE PUBLIC</p>
          <h2>Chasse au trésor {enabled ? "activée" : "désactivée"}</h2>
          <p className={styles.activationCopy}>
            {enabled
              ? "Les chasses publiées peuvent apparaître dans la partie publique."
              : "Le jeu est entièrement masqué côté public, même si une ancienne chasse existe."}
          </p>
        </div>
        <form action={setTreasureHuntEnabled}>
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <button
            className={enabled ? styles.dangerButton : styles.primaryButton}
            type="submit"
          >
            {enabled ? "Désactiver le jeu" : "Activer le jeu"}
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <p className="eyebrow">NOUVEL ÉVÉNEMENT</p>
        <h2>Créer une chasse au trésor</h2>
        <form action={createTreasureHunt} className={styles.formGrid}>
          <label>
            Titre
            <input name="title" required placeholder="La chasse au trésor Nostra" />
          </label>
          <label>
            Lot à gagner
            <input name="prize" placeholder="Véhicule, argent, récompense…" />
          </label>
          <label>
            Point de départ
            <input name="meeting_point" placeholder="Lieu de rendez-vous" />
          </label>
          <label>
            Début
            <input type="datetime-local" name="starts_at" />
          </label>
          <label>
            Fin
            <input type="datetime-local" name="ends_at" />
          </label>
          <label className={styles.full}>
            Description et règles
            <textarea
              name="description"
              rows={5}
              required
              placeholder="Explique le principe, les règles et la façon de gagner."
            />
          </label>
          <div className={styles.actions}>
            <span>La chasse est créée en brouillon. Tu la publies ensuite.</span>
            <button className={styles.primaryButton} type="submit">
              Créer la chasse
            </button>
          </div>
        </form>
      </section>

      <section className={styles.huntList}>
        {hunts.length === 0 && (
          <div className={styles.empty}>Aucune chasse au trésor créée.</div>
        )}

        {hunts.map((hunt) => (
          <article className={styles.huntCard} key={hunt.id}>
            <div className={styles.huntHeader}>
              <div>
                <span className={styles.status}>{statusLabel(hunt.status)}</span>
                <h2>{hunt.title}</h2>
                <div className={styles.huntMeta}>
                  <span>{hunt.clue_count} indice(s)</span>
                  <span>{hunt.revealed_clue_count} révélé(s)</span>
                  {hunt.prize && <span>Lot : {hunt.prize}</span>}
                </div>
              </div>
              <form action={deleteTreasureHunt}>
                <input type="hidden" name="id" value={hunt.id} />
                <button className={styles.dangerButton} type="submit">
                  Supprimer
                </button>
              </form>
            </div>

            <form action={updateTreasureHunt} className={styles.formGrid}>
              <input type="hidden" name="id" value={hunt.id} />
              <label>
                Titre
                <input name="title" defaultValue={hunt.title} required />
              </label>
              <label>
                Statut
                <select name="status" defaultValue={hunt.status}>
                  <option value="draft">Brouillon</option>
                  <option value="published">Publiée</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </label>
              <label>
                Lot à gagner
                <input name="prize" defaultValue={hunt.prize ?? ""} />
              </label>
              <label>
                Point de départ
                <input name="meeting_point" defaultValue={hunt.meeting_point ?? ""} />
              </label>
              <label>
                Début
                <input
                  type="datetime-local"
                  name="starts_at"
                  defaultValue={localDate(hunt.starts_at)}
                />
              </label>
              <label>
                Fin
                <input
                  type="datetime-local"
                  name="ends_at"
                  defaultValue={localDate(hunt.ends_at)}
                />
              </label>
              <label>
                Gagnant
                <input
                  name="winner_name"
                  defaultValue={hunt.winner_name ?? ""}
                  placeholder="Nom du gagnant"
                />
              </label>
              <label>
                Note sur le résultat
                <input
                  name="winner_note"
                  defaultValue={hunt.winner_note ?? ""}
                  placeholder="Lieu trouvé, récompense remise…"
                />
              </label>
              <label className={styles.full}>
                Description et règles
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={hunt.description}
                  required
                />
              </label>
              <div className={styles.actions}>
                <span>Le statut « Publiée » rend l’événement visible aux citoyens.</span>
                <button className={styles.primaryButton} type="submit">
                  Enregistrer
                </button>
              </div>
            </form>

            <section className={styles.clueSection}>
              <div className={styles.clueHeader}>
                <div>
                  <p className="eyebrow">INDICES</p>
                  <h3>Préparer les indices</h3>
                </div>
                <form action={revealNextTreasureHuntClue}>
                  <input type="hidden" name="hunt_id" value={hunt.id} />
                  <button className={styles.secondaryButton} type="submit">
                    Révéler le prochain indice
                  </button>
                </form>
              </div>

              <form
                action={addTreasureHuntClue}
                className={styles.clueForm}
                encType="multipart/form-data"
              >
                <input type="hidden" name="hunt_id" value={hunt.id} />
                <label>
                  Titre de l’indice
                  <input name="title" required placeholder="Indice n°1" />
                </label>
                <label>
                  Zone facultative
                  <input name="zone" placeholder="Ex. Locmaria, circuit, port…" />
                </label>
                <label className={styles.full}>
                  Texte de l’indice
                  <textarea name="content" rows={3} required />
                </label>
                <label className={styles.full}>
                  Image facultative depuis ton PC
                  <input
                    name="image_file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                  />
                  <small style={uploadHelpStyle}>
                    JPG, PNG, WEBP ou GIF — 8 Mo maximum. L’image sera envoyée automatiquement.
                  </small>
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" name="is_revealed" />
                  Rendre cet indice visible immédiatement
                </label>
                <div className={styles.actions}>
                  <span>Tu peux ajouter autant d’indices que nécessaire.</span>
                  <button className={styles.primaryButton} type="submit">
                    Ajouter l’indice
                  </button>
                </div>
              </form>

              <div className={styles.clueList}>
                {hunt.clues.length === 0 && (
                  <div className={styles.empty}>Aucun indice préparé.</div>
                )}

                {hunt.clues.map((clue, index) => (
                  <article className={styles.clueCard} key={clue.id}>
                    <div className={styles.clueHeader}>
                      <div className={styles.inlineActions}>
                        <span className={styles.clueNumber}>{index + 1}</span>
                        <strong>{clue.title}</strong>
                        <span className={styles.status}>
                          {clue.is_revealed ? "Visible" : "Masqué"}
                        </span>
                      </div>
                      <div className={styles.inlineActions}>
                        <form action={moveTreasureHuntClue}>
                          <input type="hidden" name="id" value={clue.id} />
                          <input type="hidden" name="hunt_id" value={hunt.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button className={styles.miniButton} type="submit">
                            ↑
                          </button>
                        </form>
                        <form action={moveTreasureHuntClue}>
                          <input type="hidden" name="id" value={clue.id} />
                          <input type="hidden" name="hunt_id" value={hunt.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button className={styles.miniButton} type="submit">
                            ↓
                          </button>
                        </form>
                        <form action={deleteTreasureHuntClue}>
                          <input type="hidden" name="id" value={clue.id} />
                          <button className={styles.dangerButton} type="submit">
                            Supprimer
                          </button>
                        </form>
                      </div>
                    </div>

                    <form
                      action={updateTreasureHuntClue}
                      className={styles.clueForm}
                      encType="multipart/form-data"
                    >
                      <input type="hidden" name="id" value={clue.id} />
                      <input type="hidden" name="hunt_id" value={hunt.id} />
                      <label>
                        Titre
                        <input name="title" defaultValue={clue.title} required />
                      </label>
                      <label>
                        Zone
                        <input name="zone" defaultValue={clue.zone ?? ""} />
                      </label>
                      <label className={styles.full}>
                        Texte
                        <textarea
                          name="content"
                          rows={3}
                          defaultValue={clue.content}
                          required
                        />
                      </label>
                      <label className={styles.full}>
                        Remplacer l’image depuis ton PC
                        <input
                          name="image_file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                        />
                        <small style={uploadHelpStyle}>
                          Laisse vide pour garder l’image actuelle. Taille maximale : 8 Mo.
                        </small>
                        {clue.image_url && (
                          <img
                            src={clue.image_url}
                            alt={`Aperçu de l’indice ${clue.title}`}
                            style={previewStyle}
                          />
                        )}
                      </label>
                      {clue.image_url && (
                        <label className={styles.checkbox}>
                          <input type="checkbox" name="remove_image" />
                          Supprimer l’image actuelle
                        </label>
                      )}
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          name="is_revealed"
                          defaultChecked={clue.is_revealed}
                        />
                        Indice visible par les citoyens
                      </label>
                      <div className={styles.actions}>
                        <span />
                        <button className={styles.secondaryButton} type="submit">
                          Enregistrer l’indice
                        </button>
                      </div>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          </article>
        ))}
      </section>
    </div>
  );
}
