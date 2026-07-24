import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/access";
import { getRequestRoleKeys, getRequestUser } from "@/lib/auth/request-context";
import { getRpName } from "@/lib/auth/user-profile";

export async function Topbar() {
  const [user, roleKeys] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
  ]);

  const rpName = getRpName(user);
  const role = roleKeys.map((key) => ROLE_LABELS[key]).join(" · ");
  const dashboardAccess = roleKeys.some((roleKey) =>
    ["manager", "commissioner", "employee", "commercial"].includes(roleKey),
  );
  const commissionerAccess =
    roleKeys.includes("manager") || roleKeys.includes("commissioner");

  return (
    <header className="topbar">
      <Link href="/accueil" className="brand-mini">
        <span className="brand-mark">N</span>
        <span>NOSTRA GROUP</span>
      </Link>

      <div className="top-actions">
        {rpName && (
          <span className="top-identity">
            <strong>{rpName}</strong>
            <small>{role}</small>
          </span>
        )}

        <Link href="/accueil" className="top-link">
          Accueil
        </Link>
        {commissionerAccess && (
          <Link href="/commissaires" className="top-link">
            Commissaires
          </Link>
        )}
        <Link href="/profil" className="top-link">
          Mon profil
        </Link>
        {dashboardAccess && (
          <a href="/dashboard" className="top-link top-link-gold">
            Dashboard
          </a>
        )}

        <form action={signOut}>
          <button className="logout" type="submit">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
