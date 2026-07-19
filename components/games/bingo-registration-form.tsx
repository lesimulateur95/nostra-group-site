"use client";

import { useMemo, useState } from "react";
import { addBingoToCart } from "@/app/actions/bingo";

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function BingoRegistrationForm({
  firstName,
  lastName,
  cardPrice,
}: {
  firstName: string;
  lastName: string;
  cardPrice: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const total = useMemo(() => cardPrice * quantity, [cardPrice, quantity]);

  return (
    <form action={addBingoToCart} className="bingo-registration-form">
      <div className="bingo-form-grid">
        <label><span>Prénom RP</span><input name="first_name" required minLength={2} maxLength={40} defaultValue={firstName} /></label>
        <label><span>Nom RP</span><input name="last_name" required minLength={2} maxLength={40} defaultValue={lastName} /></label>
        <label><span>Nombre de grilles</span><input name="quantity" type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
      </div>
      <div className="bingo-price-preview">
        <span>Prix d’une grille <strong>{money(cardPrice)}</strong></span>
        <span>Total du panier <strong>{money(total)}</strong></span>
      </div>
      <button className="btn" type="submit">Ajouter les grilles au panier</button>
    </form>
  );
}
