"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./steam-association.module.css";

export function SteamLinkDiscordButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function linkWithDiscord() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?steam_link=1`,
      },
    });

    if (oauthError) {
      setError(
        "La connexion Discord n’a pas pu démarrer. Vérifie la configuration Supabase.",
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.discordBlock}>
      <button
        className={styles.discordButton}
        disabled={loading}
        onClick={linkWithDiscord}
        type="button"
      >
        {loading
          ? "Connexion Discord…"
          : "J’ai déjà un compte — le relier avec Discord"}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
