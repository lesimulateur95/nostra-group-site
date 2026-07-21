"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { addPilotLicenseToCart } from "@/app/actions/licenses";
import type { PilotLicenseType } from "@/lib/licenses/data";
import styles from "@/components/circuit/pilot-license-form.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.submit} type="submit" disabled={pending}>
      {pending
        ? "Ajout du dossier en cours…"
        : "Ajouter la demande au panier"}
    </button>
  );
}

export function PilotLicenseForm({
  licenseTypes,
  profileName,
  profilePhone,
  internalEmail,
}: {
  licenseTypes: PilotLicenseType[];
  profileName: string;
  profilePhone: string;
  internalEmail: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const fillFromProfile = () => {
    setName(profileName);
    setPhone(profilePhone);
  };

  return (
    <form
      action={addPilotLicenseToCart}
      className={styles.form}
      encType="multipart/form-data"
    >
      <div className={styles.formHeading}>
        <div>
          <span>FORMULAIRE DE LICENCE</span>
          <h2>Informations du pilote</h2>
        </div>

        <button
          className={styles.prefill}
          type="button"
          onClick={fillFromProfile}
        >
          Remplir depuis mon profil
        </button>
      </div>

      <div className={styles.grid}>
        <label>
          <span>Licence demandée</span>
          <select name="license_code" required defaultValue="">
            <option value="" disabled>
              Choisir une licence
            </option>

            {licenseTypes.map((license) => (
              <option key={license.code} value={license.code}>
                {license.label} — {money(license.price)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Nom et prénom</span>
          <input
            name="applicant_name"
            type="text"
            minLength={3}
            maxLength={120}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom et prénom du pilote"
          />
        </label>

        <label>
          <span>Numéro de téléphone</span>
          <input
            name="phone"
            type="tel"
            minLength={5}
            maxLength={40}
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Exemple : 06 00 00 00 00"
          />
        </label>

        <label>
          <span>Adresse de messagerie interne</span>
          <input
            type="text"
            value={internalEmail}
            readOnly
            aria-readonly="true"
          />
          <small>
            Cette adresse est fournie automatiquement par la messagerie
            Nostra Group et ne peut pas être remplacée dans le formulaire.
          </small>
        </label>

        <label className={styles.certificate}>
          <span>Certificat médical</span>
          <input
            name="medical_certificate"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            required
          />
          <small>
            Le document doit attester l’aptitude à la conduite sur circuit.
            Formats acceptés : PDF, JPG ou PNG, 10 Mo maximum.
          </small>
        </label>
      </div>

      <div className={styles.security}>
        <strong>Document confidentiel</strong>
        <p>
          Le certificat médical est conservé dans un espace privé. Il
          n’est accessible qu’au titulaire du dossier et aux responsables
          autorisés du Nostra Circuit.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
