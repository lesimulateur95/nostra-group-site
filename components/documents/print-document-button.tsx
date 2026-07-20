
"use client";

export function PrintDocumentButton() {
  return (
    <button
      className="btn"
      type="button"
      onClick={() => window.print()}
    >
      Imprimer / Enregistrer en PDF
    </button>
  );
}
