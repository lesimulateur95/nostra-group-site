"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import styles from "@/app/(protected)/profil/informations-bancaires/page.module.css";

export function BankRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className={styles.refreshButton}
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <span aria-hidden="true">↻</span>
      {pending ? "Actualisation…" : "Actualiser les soldes"}
    </button>
  );
}
