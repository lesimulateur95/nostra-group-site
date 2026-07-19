import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getUserRoleKey, ROLE_LABELS } from "@/lib/auth/access";
import { getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export async function Topbar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const rpName = getRpName(user);
  const roleKey = await getUserRoleKey(user);
  const role = ROLE_LABELS[roleKey];
  const dashboardAccess = roleKey === "manager";
  const commissionerAccess = roleKey === "manager" || roleKey === "commissioner";

  return (
    <header className="topbar">
      <Link href="/accueil" className="brand-mini">
        <span className="brand-mark">N</span>
        <span>NOSTRA GROUP</span>
      </Link>
      <div className="top-actions">
        {rpName && <span className="top-identity"><strong>{rpName}</strong><small>{role}</small></span>}
        <Link href="/accueil" className="top-link">Accueil</Link>
        {commissionerAccess && <Link href="/commissaires" className="top-link">Commissaires</Link>}
        <Link href="/profil" className="top-link">Mon profil</Link>
        {dashboardAccess && <Link href="/dashboard" className="top-link top-link-gold">Dashboard</Link>}
        <form action={signOut}>
          <button className="logout" type="submit">Déconnexion</button>
        </form>
      </div>
    </header>
  );
}
