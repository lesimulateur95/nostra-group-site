"use client";

/**
 * Ancien comparateur V1 désactivé.
 *
 * Il utilisait un portail et un MutationObserver pour injecter
 * automatiquement un comparateur dans la page. Lorsque la V51
 * chargeait son comparateur séparé par catalogue, les deux systèmes
 * s'affichaient ensemble.
 *
 * L'export est conservé pour ne casser aucun ancien import, mais
 * ce composant ne rend plus rien et ne modifie plus le DOM.
 */
export function CatalogueComparatorEnhancer() {
  return null;
}
