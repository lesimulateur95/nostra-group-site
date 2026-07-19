"use client";

import { useMemo, useState } from "react";
import { addTombolaToCart } from "@/app/actions/tombola";

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function TombolaRegistrationForm({
  firstName,
  lastName,
  ticketPrice,
}: {
  firstName: string;
  lastName: string;
  ticketPrice: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const total = useMemo(() => Math.max(1, quantity) * ticketPrice, [quantity, ticketPrice]);

  return (
    <form action={addTombolaToCart} className="tombola-registration-form">
      <div className="tombola-form-grid">
        <label>
          <span>Prénom RP</span>
          <input name="first_name" defaultValue={firstName} minLength={2} maxLength={40} required />
        </label>
        <label>
          <span>Nom RP</span>
          <input name="last_name" defaultValue={lastName} minLength={2} maxLength={40} required />
        </label>
        <label>
          <span>Nombre de tickets</span>
          <input
            name="quantity"
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
            required
          />
        </label>
        <div className="tombola-price-preview">
          <span>Prix par ticket</span>
          <strong>{money(ticketPrice)}</strong>
        </div>
      </div>

      <div className="tombola-cart-preview">
        <div>
          <small>Montant ajouté au panier</small>
          <strong>{money(total)}</strong>
        </div>
        <button className="btn" type="submit">Ajouter au panier</button>
      </div>
      <p className="commerce-hint">Les numéros aléatoires et uniques seront attribués automatiquement lorsque tu valideras la commande depuis ton profil.</p>
    </form>
  );
}
