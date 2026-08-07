"use client";

import { useEffect, useState } from "react";
import styles from "./login-button.module.css";

const errorMessages: Record<string, string> = {
  state: "La demande Steam a expiré. Relance simplement la connexion.",
  verification: "Steam n’a pas pu confirmer ton identité.",
  configuration:
    "La connexion Steam n’est pas encore entièrement configurée sur le site.",
  "pending-expired":
    "La liaison Steam a expiré. Recommence depuis la page de connexion.",
  creation: "Le compte Nostra Group n’a pas pu être créé avec Steam.",
  "already-linked": "Ce compte Steam est déjà relié à un autre citoyen.",
};

export function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("steam_error");
    if (code) setError(errorMessages[code] ?? "La connexion a échoué.");
  }, []);

  function loginWithSteam() {
    setLoading(true);
    setError("");
    window.location.assign("/auth/steam");
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.steamButton}
        disabled={loading}
        onClick={loginWithSteam}
        type="button"
      >
        <span aria-hidden="true" className={styles.steamLogo}>
          <svg viewBox="0 0 24 24">
            <path d="M11.98 1.5a10.5 10.5 0 0 0-10.4 9.1l5.58 2.3a3.25 3.25 0 0 1 1.86-.58l2.5-3.62v-.05a4.32 4.32 0 1 1 4.32 4.32h-.1l-3.56 2.54a3.28 3.28 0 0 1-6.45.7L1.9 14.62A10.5 10.5 0 1 0 11.98 1.5Zm-3.07 15.98-1.28-.53a2.46 2.46 0 1 0 1.28-3.97 2.44 2.44 0 0 0-.91.18l1.32.55a1.82 1.82 0 1 1-1.4 3.36l-1.28-.53a2.45 2.45 0 0 0 2.27.94Zm6.93-5.96a2.88 2.88 0 1 0 0-5.76 2.88 2.88 0 0 0 0 5.76Zm0-.72a2.16 2.16 0 1 1 0-4.32 2.16 2.16 0 0 1 0 4.32Z" />
          </svg>
        </span>
        <span>
          <small>CONNEXION STEAM</small>
          <strong>{loading ? "Redirection vers Steam…" : "Se connecter avec Steam"}</strong>
        </span>
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
