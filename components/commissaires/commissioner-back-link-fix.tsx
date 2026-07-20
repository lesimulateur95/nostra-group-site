"use client";

import { useEffect } from "react";

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function rewriteLinks() {
  const links = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];

  links.forEach((link) => {
    const text = normalize(link.textContent);
    const href = link.getAttribute("href") ?? "";

    const looksLikeDashboardBackLink =
      href === "/dashboard" ||
      href === "dashboard" ||
      text.includes("retour au dashboard");

    if (!looksLikeDashboardBackLink) return;

    link.setAttribute("href", "/commissaires");
    link.textContent = "← Retour à l’espace commissaires";
  });
}

export function CommissionerBackLinkFix() {
  useEffect(() => {
    rewriteLinks();

    const observer = new MutationObserver(() => {
      rewriteLinks();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
