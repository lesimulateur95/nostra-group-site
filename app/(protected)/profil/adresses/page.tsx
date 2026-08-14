import { redirect } from "next/navigation";
import {
  deleteDeliveryAddressV161,
  saveDeliveryAddressV161,
  setDefaultDeliveryAddressV161,
} from "@/app/actions/v161-logistics";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getMyDeliveryAddressesV161 } from "@/lib/nostra-motors/v161-data";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/motors/v161-logistics.module.css";

type Props = {
  searchParams: Promise<{ saved?: string; deleted?: string; default?: string; error?: string }>;
};

export default async function DeliveryAddressesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const [params, addresses] = await Promise.all([
    searchParams,
    getMyDeliveryAddressesV161(data.user.id),
  ]);

  return (
    <>
      <ProfileSectionHeader
        eyebrow="NOSTRA MOTORS"
        title="Mes adresses de livraison"
        description="Enregistre ton domicile, ton garage ou ton entreprise une seule fois puis sélectionne l’adresse directement au moment de la commande."
      />

      {(params.saved || params.default) && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Adresse enregistrée.
        </div>
      )}
      {params.deleted && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Adresse supprimée.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          L’adresse n’a pas pu être enregistrée. Vérifie les informations saisies.
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>NOUVELLE ADRESSE</span>
            <h2>Ajouter au carnet</h2>
            <p>L’adresse définie par défaut sera proposée automatiquement dans le panier.</p>
          </div>
        </div>
        <form action={saveDeliveryAddressV161} className={styles.addressForm}>
          <label>
            <span>Nom de l’adresse</span>
            <input name="label" maxLength={80} placeholder="Maison principale" required />
          </label>
          <label>
            <span>Téléphone</span>
            <input name="phone" type="tel" maxLength={40} placeholder="06 12 34 56 78" />
          </label>
          <label className={styles.addressFormFull}>
            <span>Adresse / lieu</span>
            <input name="address_line" maxLength={300} placeholder="Villa 24, quartier du port" required />
          </label>
          <label>
            <span>Ville</span>
            <input name="city" maxLength={100} placeholder="Kavala" />
          </label>
          <label>
            <span>Zone / complément</span>
            <input name="zone" maxLength={100} placeholder="Entrée arrière du garage" />
          </label>
          <label className={styles.addressFormFull}>
            <span>Instructions de livraison</span>
            <textarea name="instructions" rows={3} maxLength={500} placeholder="Appeler avant d’arriver, portail côté mer…" />
          </label>
          <label className={styles.addressFormFull}>
            <span><input type="checkbox" name="is_default" /> Définir comme adresse par défaut</span>
          </label>
          <div className={`${styles.actions} ${styles.addressFormFull}`}>
            <button className={styles.primaryButton} type="submit">Ajouter l’adresse</button>
          </div>
        </form>
      </section>

      <section className={styles.addressGrid}>
        {addresses.length === 0 && (
          <div className={styles.empty}>Aucune adresse enregistrée pour le moment.</div>
        )}
        {addresses.map((address) => (
          <article
            className={`${styles.addressCard} ${address.is_default ? styles.addressCardDefault : ""}`}
            key={address.id}
          >
            <div className={styles.addressCardHead}>
              <div>
                <span className={styles.eyebrow}>{address.is_default ? "ADRESSE PAR DÉFAUT" : "ADRESSE ENREGISTRÉE"}</span>
                <h3>{address.label}</h3>
              </div>
              {address.is_default && <span className={styles.stageBadge}>Défaut</span>}
            </div>
            <p>{[address.address_line, address.city, address.zone].filter(Boolean).join(", ")}</p>
            <small>{address.phone || "Aucun téléphone spécifique"}</small>
            {address.instructions && <small>Consignes : {address.instructions}</small>}
            <div className={styles.addressActions}>
              {!address.is_default && (
                <form action={setDefaultDeliveryAddressV161}>
                  <input type="hidden" name="id" value={address.id} />
                  <button className={styles.secondaryButton} type="submit">Définir par défaut</button>
                </form>
              )}
              <form action={deleteDeliveryAddressV161}>
                <input type="hidden" name="id" value={address.id} />
                <button className={styles.dangerButton} type="submit">Supprimer</button>
              </form>
            </div>
            <details>
              <summary className={styles.secondaryButton}>Modifier cette adresse</summary>
              <form action={saveDeliveryAddressV161} className={styles.addressForm} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={address.id} />
                <label><span>Nom</span><input name="label" defaultValue={address.label} required /></label>
                <label><span>Téléphone</span><input name="phone" defaultValue={address.phone ?? ""} /></label>
                <label className={styles.addressFormFull}><span>Adresse / lieu</span><input name="address_line" defaultValue={address.address_line} required /></label>
                <label><span>Ville</span><input name="city" defaultValue={address.city ?? ""} /></label>
                <label><span>Zone / complément</span><input name="zone" defaultValue={address.zone ?? ""} /></label>
                <label className={styles.addressFormFull}><span>Instructions</span><textarea name="instructions" rows={2} defaultValue={address.instructions ?? ""} /></label>
                <label className={styles.addressFormFull}><span><input type="checkbox" name="is_default" defaultChecked={address.is_default} /> Adresse par défaut</span></label>
                <div className={`${styles.actions} ${styles.addressFormFull}`}><button className={styles.primaryButton} type="submit">Enregistrer les modifications</button></div>
              </form>
            </details>
          </article>
        ))}
      </section>
    </>
  );
}
