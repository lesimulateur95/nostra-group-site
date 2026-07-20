"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { saveRpProfile } from "@/app/actions/profile";
import styles from "@/components/profile/identity-card.module.css";

type IdentityCardProps = {
  complete: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  discordName: string;
  discordId: string;
  email: string;
  role: string;
  errorMessage?: string | null;
  saved?: boolean;
};

function SubmitButton({ complete }: { complete: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className={styles.saveButton} type="submit" disabled={pending}>
      {pending
        ? "Enregistrement…"
        : complete
          ? "Enregistrer les modifications"
          : "Valider mon identité"}
    </button>
  );
}

export function IdentityCard({
  complete,
  firstName,
  lastName,
  phone,
  address,
  discordName,
  discordId,
  email,
  role,
  errorMessage,
  saved = false,
}: IdentityCardProps) {
  const [editing, setEditing] = useState(!complete || Boolean(errorMessage));
  const rpName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    <details
      className={styles.card}
      defaultOpen={!complete || Boolean(errorMessage) || saved}
    >
      <summary className={styles.summary}>
        <span className={styles.summaryIcon}>◆</span>

        <span className={styles.summaryCopy}>
          <span className={styles.eyebrow}>PROFIL CITOYEN</span>
          <strong>Mon identité</strong>
          <small>
            {rpName || "Identité à compléter"}
            {phone ? ` · ${phone}` : ""}
          </small>
        </span>

        <span className={styles.chevron} aria-hidden="true">
          ⌄
        </span>
      </summary>

      <div className={styles.content}>
        {saved && (
          <div className={styles.success}>
            Tes informations personnelles ont bien été enregistrées.
          </div>
        )}

        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        <div className={styles.readonlyGrid}>
          <div>
            <span>Prénom RP</span>
            <strong>{firstName || "Non renseigné"}</strong>
          </div>

          <div>
            <span>Nom RP</span>
            <strong>{lastName || "Non renseigné"}</strong>
          </div>

          <div>
            <span>Numéro de téléphone</span>
            <strong>{phone || "Non renseigné"}</strong>
          </div>

          <div className={styles.fullWidth}>
            <span>Adresse</span>
            <strong className={styles.addressValue}>
              {address || "Non renseignée"}
            </strong>
          </div>

          <div>
            <span>Compte Discord</span>
            <strong>{discordName}</strong>
          </div>

          <div>
            <span>Rôle</span>
            <strong>{role}</strong>
          </div>

          <div>
            <span>Identifiant Discord</span>
            <strong>{discordId}</strong>
          </div>

          <div>
            <span>E-mail</span>
            <strong>{email}</strong>
          </div>
        </div>

        {!editing && (
          <div className={styles.editRow}>
            <button
              className={styles.editButton}
              type="button"
              onClick={() => setEditing(true)}
            >
              Modifier mes informations
            </button>
          </div>
        )}

        {editing && (
          <form action={saveRpProfile} className={styles.form}>
            <label>
              <span>Prénom RP</span>
              <input
                name="rp_first_name"
                required
                minLength={2}
                maxLength={32}
                defaultValue={firstName}
                placeholder="Exemple : Liam"
                autoComplete="given-name"
              />
            </label>

            <label>
              <span>Nom RP</span>
              <input
                name="rp_last_name"
                required
                minLength={2}
                maxLength={32}
                defaultValue={lastName}
                placeholder="Exemple : Nostra"
                autoComplete="family-name"
              />
            </label>

            <label>
              <span>Numéro de téléphone</span>
              <input
                name="phone"
                type="tel"
                maxLength={40}
                defaultValue={phone}
                placeholder="Exemple : 06 12 34 56 78"
                autoComplete="tel"
              />
            </label>

            <label className={styles.fullWidth}>
              <span>Adresse complète</span>
              <textarea
                name="address"
                rows={4}
                maxLength={500}
                defaultValue={address}
                placeholder="Exemple : 12 rue de Locmaria, résidence Nostra, bâtiment B"
                autoComplete="street-address"
              />
              <small>
                Cette adresse sera proposée automatiquement lors d’une
                livraison de véhicule à domicile.
              </small>
            </label>

            <div className={styles.formActions}>
              {complete && (
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={() => setEditing(false)}
                >
                  Annuler
                </button>
              )}

              <SubmitButton complete={complete} />
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
