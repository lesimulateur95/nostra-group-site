import Link from "next/link";

import { getRequestRoleKeys } from "@/lib/auth/request-context";

/** La vérification des rôles est diffusée après le premier affichage. */
export async function CommissionerPortalCard() {
  const roles = await getRequestRoleKeys();
  const hasAccess = roles.includes("manager") || roles.includes("commissioner");

  if (!hasAccess) {
    return null;
  }

  return (
    <Link href="/commissaires" className="portal-card">
      <span className="portal-kicker">ACCÈS RÉSERVÉ</span>
      <h2 className="portal-title">ESPACE COMMISSAIRES</h2>
      <p className="portal-desc">
        Règlement, planning de course en direct et rapports d’incident du Nostra
        Circuit.
      </p>
    </Link>
  );
}
