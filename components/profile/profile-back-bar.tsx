"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./profile-back-bar.module.css";

export function ProfileBackBar() {
  const pathname = usePathname();

  if (pathname === "/profil") return null;

  return (
    <nav className={styles.wrapper} aria-label="Navigation du profil">
      <Link className={styles.link} href="/profil">
        <span aria-hidden="true">←</span>
        Retour à mon profil
      </Link>
    </nav>
  );
}
