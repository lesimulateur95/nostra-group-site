"use client";

export function PrintLicenceButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Imprimer / Enregistrer en PDF
    </button>
  );
}
