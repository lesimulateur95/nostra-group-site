"use client";

import { useMemo, useState } from "react";
import type { DeliveryAddressV161 } from "@/lib/nostra-motors/v161-data";
import styles from "./v161-logistics.module.css";

function fullAddress(address: DeliveryAddressV161): string {
  return [address.address_line, address.city, address.zone].filter(Boolean).join(", ");
}

export function DeliveryAddressPickerV161({
  addresses,
  fallbackPhone = "",
  fallbackAddress = "",
}: {
  addresses: DeliveryAddressV161[];
  fallbackPhone?: string;
  fallbackAddress?: string;
}) {
  const defaultAddress = useMemo(
    () =>
      addresses.find(
        (address) =>
          fallbackAddress.trim().length > 0 &&
          fullAddress(address).trim().toLocaleLowerCase("fr-FR") ===
            fallbackAddress.trim().toLocaleLowerCase("fr-FR"),
      ) ??
      addresses.find((address) => address.is_default) ??
      addresses[0] ??
      null,
    [addresses, fallbackAddress],
  );
  const [selectedId, setSelectedId] = useState<string>(defaultAddress ? String(defaultAddress.id) : "manual");
  const selected = addresses.find((address) => String(address.id) === selectedId) ?? null;
  const [manualPhone, setManualPhone] = useState(fallbackPhone);
  const [manualAddress, setManualAddress] = useState(fallbackAddress);
  const [manualInstructions, setManualInstructions] = useState("");

  return (
    <div className={styles.addressPicker}>
      <div className={styles.addressPickerHead}>
        <div>
          <strong>Adresse de livraison</strong>
          <small>Choisis une adresse enregistrée ou saisis-en une pour cette commande.</small>
        </div>
        <a href="/profil/adresses">Gérer mes adresses</a>
      </div>

      {addresses.length > 0 && (
        <label>
          <span>Carnet d’adresses</span>
          <select
            name="delivery_address_id"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.label}{address.is_default ? " · Par défaut" : ""}
              </option>
            ))}
            <option value="manual">Utiliser une autre adresse</option>
          </select>
        </label>
      )}

      {selected ? (
        <div className={styles.savedAddressCard}>
          <strong>{selected.label}</strong>
          <span>{fullAddress(selected)}</span>
          <small>{selected.phone || fallbackPhone || "Téléphone non renseigné"}</small>
          {selected.instructions && <em>{selected.instructions}</em>}
          <input type="hidden" name="delivery_address" value={fullAddress(selected)} />
          <input type="hidden" name="delivery_phone" value={selected.phone || fallbackPhone} />
          <input type="hidden" name="delivery_address_label" value={selected.label} />
          <input type="hidden" name="delivery_instructions" value={selected.instructions ?? ""} />
        </div>
      ) : (
        <div className={styles.manualAddressGrid}>
          <label>
            <span>Téléphone de livraison</span>
            <input
              name="delivery_phone"
              type="tel"
              maxLength={40}
              value={manualPhone}
              onChange={(event) => setManualPhone(event.target.value)}
              placeholder="06 12 34 56 78"
            />
          </label>
          <label>
            <span>Adresse complète</span>
            <textarea
              name="delivery_address"
              rows={2}
              maxLength={500}
              value={manualAddress}
              onChange={(event) => setManualAddress(event.target.value)}
              placeholder="Adresse, résidence, bâtiment…"
            />
          </label>
          <label className={styles.manualAddressFull}>
            <span>Instructions de livraison <small>(facultatif)</small></span>
            <input
              name="delivery_instructions"
              maxLength={500}
              value={manualInstructions}
              onChange={(event) => setManualInstructions(event.target.value)}
              placeholder="Exemple : entrée arrière du garage, appeler avant d’arriver…"
            />
          </label>
          <input type="hidden" name="delivery_address_label" value="Adresse ponctuelle" />
          <input type="hidden" name="delivery_address_id" value="" />
        </div>
      )}
    </div>
  );
}
