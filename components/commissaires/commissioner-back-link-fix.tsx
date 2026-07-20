"use client";

import { useEffect } from "react";

const COMMISSIONER_PANEL_URL = "/commissaires";
const COMMISSIONER_BACK_LABEL = "← Retour à l’espace commissaires";

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isCommissionerBackLink(link: HTMLAnchorElement): boolean {
  const text = normalize(link.textContent);
  const rawHref = link.getAttribute("href") ?? "";

  return (
    link.dataset.commissionerBackLink === "true" ||
    text.includes("retour au dashboard") ||
    text.includes("retour à l’espace commissaires") ||
    rawHref === "/dashboard"
  );
}

function rewriteLinks() {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a"),
  );

  links.forEach((link) => {
    if (!isCommissionerBackLink(link)) return;

    link.dataset.commissionerBackLink = "true";
    link.setAttribute("href", COMMISSIONER_PANEL_URL);
    link.textContent = COMMISSIONER_BACK_LABEL;
  });
}

export function CommissionerBackLinkFix() {
  useEffect(() => {
    rewriteLinks();

    const handleClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>("a");
      if (!link || !isCommissionerBackLink(link)) return;

      // Le Link Next.js d'origine conserve son ancien href dans React.
      // On bloque donc sa navigation avant qu'elle ne s'exécute.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      window.location.assign(COMMISSIONER_PANEL_URL);
    };

    document.addEventListener("click", handleClick, true);

    const observer = new MutationObserver(() => {
      rewriteLinks();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
