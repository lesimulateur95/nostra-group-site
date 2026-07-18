import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export function Topbar() {
  return (
    <header className="topbar">
      <Link href="/accueil" className="brand-mini">
        <span className="brand-mark">N</span>
        <span>NOSTRA GROUP</span>
      </Link>
      <div className="top-actions">
        <Link href="/accueil" className="top-link">Accueil</Link>
        <form action={signOut}>
          <button className="logout" type="submit">Déconnexion</button>
        </form>
      </div>
    </header>
  );
}
